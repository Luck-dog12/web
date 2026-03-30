import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import { getDatabaseUrl } from '../config/env';

type GeneratedPrismaModule = typeof import('../../generated/prisma');

function isMissingModuleError(error: unknown, request: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' &&
    error instanceof Error &&
    error.message.includes(request)
  );
}

function loadPrismaClient() {
  const requests = [
    '../../generated/prisma',
    path.resolve(__dirname, '../../../../src/generated/prisma'),
  ];
  let lastError: unknown;

  for (const request of requests) {
    try {
      return (require(request) as GeneratedPrismaModule).PrismaClient;
    } catch (error) {
      if (!isMissingModuleError(error, request)) throw error;
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to load generated Prisma client');
}

const PrismaClient = loadPrismaClient();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = getDatabaseUrl();
    process.env.DATABASE_URL = databaseUrl;
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
