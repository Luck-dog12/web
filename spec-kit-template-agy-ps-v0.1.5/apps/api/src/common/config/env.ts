export type AppEnv = {
  port: number;
  webBaseUrl: string;
  webBaseUrls: string[];
  sessionSecret: string;
  databaseUrl: string;
  redisUrl?: string;
};

export function getAppEnv(): AppEnv {
  const port = Number(process.env.PORT ?? 3001);
  const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
  const webBaseUrls = (process.env.WEB_BASE_URLS ?? webBaseUrl)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const sessionSecret = process.env.SESSION_SECRET ?? 'dev-session-secret';
  const databaseUrl =
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/spec_kit?schema=public';
  const redisUrl = process.env.REDIS_URL || undefined;

  return { port, webBaseUrl, webBaseUrls, sessionSecret, databaseUrl, redisUrl };
}
