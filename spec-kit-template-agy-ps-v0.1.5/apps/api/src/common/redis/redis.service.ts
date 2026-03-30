import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getAppEnv } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null;

  constructor() {
    const { redisUrl } = getAppEnv();
    this.client = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : null;
  }

  getClient() {
    return this.client;
  }

  async assertHealthy() {
    if (!this.client) return;
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }
    } catch (error) {
      this.client.disconnect(false);
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Redis connection error';
      throw new Error(`Failed to connect to Redis: ${message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
