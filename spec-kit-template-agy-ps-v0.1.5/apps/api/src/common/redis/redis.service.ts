import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor() {
    const url = process.env.REDIS_URL;
    this.client = url ? new Redis(url) : null;
  }

  getClient() {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
