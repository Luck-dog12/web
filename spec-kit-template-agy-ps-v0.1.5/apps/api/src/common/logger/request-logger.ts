import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const payload = {
      level: 'info',
      method: req.method,
      path: req.originalUrl ?? req.url,
      statusCode: res.statusCode,
      durationMs,
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  });
  next();
}
