import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import express from 'express';
import session from 'express-session';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { getAppEnv } from './common/config/env';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createRateLimitMiddleware } from './common/middleware/rate-limit';
import { requestLogger } from './common/logger/request-logger';
import { initSentry } from './common/observability/sentry';
import { RedisSessionStore } from './common/redis/redis-session.store';
import { RedisService } from './common/redis/redis.service';

async function bootstrap() {
  const initCwd = process.env.INIT_CWD;
  const envCandidates = Array.from(
    new Set([
      ...(initCwd
        ? [path.resolve(initCwd, '.env'), path.resolve(initCwd, 'apps/api/.env')]
        : []),
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'apps/api/.env'),
    ]),
  );
  const envPath = envCandidates.find((p) => fs.existsSync(p));
  if (envPath) loadEnv({ path: envPath });

  const env = getAppEnv();

  initSentry('api');

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const redisService = app.get(RedisService);
  await redisService.assertHealthy();
  const redisClient = redisService.getClient();

  if (env.isProduction && !redisClient) {
    throw new Error('REDIS_URL is required in production for session storage');
  }

  if (env.secureCookies) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use((_, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(requestLogger);
  app.use(createRateLimitMiddleware());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    session({
      name: 'sid',
      secret: env.sessionSecret,
      proxy: env.secureCookies,
      resave: false,
      saveUninitialized: false,
      store: redisClient
        ? new RedisSessionStore(redisClient, {
            ttlSeconds: env.sessionTtlSeconds,
          })
        : undefined,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.secureCookies,
        maxAge: env.sessionTtlSeconds * 1000,
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (env.webBaseUrls.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.listen(env.port);
}
bootstrap().catch((error) => {
  console.error('[api bootstrap] failed', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL ?? process.env.DIRECT_URL),
    hasRedisUrl: Boolean(process.env.REDIS_URL),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
  });
  process.exit(1);
});
