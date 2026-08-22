import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Fixed-window rate limiter.
 *  - Upstash Redis (REST) when UPSTASH_REDIS_REST_URL/TOKEN are set → shared across serverless instances.
 *  - In-memory fallback otherwise (per process; fine for local dev, weak on serverless).
 */
const memory = new Map<string, { count: number; resetAt: number }>();

async function hit(key: string, windowMs: number): Promise<number> {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const bucket = Math.floor(Date.now() / windowMs);
    const k = `rl:${key}:${bucket}`;
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', k], ['PEXPIRE', k, String(windowMs)]]),
    });
    const data: any = await res.json();
    return Number(data?.[0]?.result ?? 0);
  }
  const now = Date.now();
  const e = memory.get(key);
  if (!e || now > e.resetAt) { memory.set(key, { count: 1, resetAt: now + windowMs }); return 1; }
  e.count += 1; return e.count;
}

export function rateLimit({ windowMs, max, keyGenerator }: { windowMs: number; max: number; keyGenerator?: (req: Request) => string }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = (keyGenerator ? keyGenerator(req) : req.ip) || 'unknown';
      const count = await hit(key, windowMs);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      if (count > max) return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try later' } });
      next();
    } catch (e) { next(); } // never block traffic because the limiter backend is down
  };
}

export const rateLimitDriverName = env.UPSTASH_REDIS_REST_URL ? 'upstash' : 'memory';
export const loginRateLimiter = rateLimit({ windowMs: 15*60*1000, max: 20 });
export const authRateLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, keyGenerator: (req) => req.ip + ':' + (req.body?.email || '') });
