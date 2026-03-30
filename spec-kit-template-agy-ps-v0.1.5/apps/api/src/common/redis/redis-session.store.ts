import session from 'express-session';
import type Redis from 'ioredis';

type SessionCallback = (err?: unknown, session?: session.SessionData | null) => void;
type Callback = (err?: unknown) => void;

export class RedisSessionStore extends session.Store {
  constructor(
    private readonly client: Redis,
    private readonly options: { prefix?: string; ttlSeconds?: number } = {},
  ) {
    super();
  }

  private get prefix() {
    return this.options.prefix ?? 'session:';
  }

  private get ttlSeconds() {
    return Math.max(1, this.options.ttlSeconds ?? 60 * 60 * 24 * 7);
  }

  private getKey(sid: string) {
    return `${this.prefix}${sid}`;
  }

  private getSessionTtlSeconds(sess?: session.SessionData) {
    const maxAge = sess?.cookie?.maxAge;
    if (typeof maxAge === 'number' && Number.isFinite(maxAge)) {
      return Math.max(1, Math.ceil(maxAge / 1000));
    }
    return this.ttlSeconds;
  }

  override get(sid: string, callback: SessionCallback) {
    void this.client
      .get(this.getKey(sid))
      .then((value) => callback(undefined, value ? (JSON.parse(value) as session.SessionData) : null))
      .catch((error) => callback(error));
  }

  override set(sid: string, sess: session.SessionData, callback?: Callback) {
    void this.client
      .set(this.getKey(sid), JSON.stringify(sess), 'EX', this.getSessionTtlSeconds(sess))
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  override destroy(sid: string, callback?: Callback) {
    void this.client
      .del(this.getKey(sid))
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  override touch(sid: string, sess: session.SessionData, callback?: Callback) {
    void this.client
      .expire(this.getKey(sid), this.getSessionTtlSeconds(sess))
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}
