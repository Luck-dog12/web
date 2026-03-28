import { Request, Response, NextFunction } from 'express';

export function createRateLimitMiddleware(options?: {
  limitPerMinute?: number;
}) {
  const limitPerMinute = options?.limitPerMinute ?? 120;
  const store = new Map<string, { resetAt: number; count: number }>();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const item = store.get(key);

    if (!item || now >= item.resetAt) {
      store.set(key, { resetAt: now + 60_000, count: 1 });
      next();
      return;
    }

    if (item.count >= limitPerMinute) {
      res.status(429).json({ statusCode: 429, message: 'Too Many Requests' });
      return;
    }

    item.count += 1;
    next();
  };
}
