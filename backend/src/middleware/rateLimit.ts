import { Request, Response, NextFunction } from 'express';

// In-memory rate limiter (per IP). For production would be MySQL/Redis backed.
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit({ windowMs, max, keyGenerator }: { windowMs: number; max: number; keyGenerator?: (req: Request) => string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try later' } });
    }
    entry.count += 1;
    next();
  };
}

export const loginRateLimiter = rateLimit({ windowMs: 15*60*1000, max: 20 });
export const authRateLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, keyGenerator: (req) => req.ip + ':' + (req.body?.email || '') });
