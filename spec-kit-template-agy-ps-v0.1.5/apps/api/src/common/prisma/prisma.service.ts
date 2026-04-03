import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { getDatabaseUrl } from '../config/env';

type GeneratedPrismaModule = typeof import('../../generated/prisma');

function isMissingModuleError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND'
  );
}

function loadPrismaClient() {
  try {
    return (require('../../generated/prisma') as GeneratedPrismaModule)
      .PrismaClient;
  } catch (error) {
    if (!isMissingModuleError(error)) throw error;
  }

  try {
    return (require('../../../../src/generated/prisma') as GeneratedPrismaModule)
      .PrismaClient;
  } catch (error) {
    if (!isMissingModuleError(error)) throw error;
    throw new Error('Unable to load generated Prisma client');
  }
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
