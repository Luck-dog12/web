import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const databaseUrl =
      process.env.DATABASE_URL ??
      process.env.DIRECT_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/spec_kit?schema=public';
    const max = Number(process.env.DATABASE_POOL_MAX ?? 10);
    process.env.DATABASE_URL = databaseUrl;
    const pool = new Pool({
      connectionString: databaseUrl,
      max: Number.isFinite(max) && max > 0 ? max : 10,
    });

    super({
      adapter: new PrismaPg(pool),
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
