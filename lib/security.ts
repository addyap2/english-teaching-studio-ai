import { timingSafeEqual, createHash } from 'node:crypto';

/** Constant-time comparison (hashing first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

export type AccessResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * The studio is private: AI calls cost money, so a passphrase (APP_ACCESS_KEY)
 * is required in production. In local development it is optional.
 */
export function checkAccess(provided: string | null, env: NodeJS.ProcessEnv = process.env): AccessResult {
  const expected = env.APP_ACCESS_KEY?.trim();
  if (!expected) {
    if (env.NODE_ENV === 'production')
      return { ok: false, status: 503, error: 'The server has no APP_ACCESS_KEY set, so AI generation is switched off to protect your API credit.' };
    return { ok: true };
  }
  if (!provided || !safeEqual(provided.trim(), expected)) return { ok: false, status: 401, error: 'Incorrect access key.' };
  return { ok: true };
}

export function accessKeyRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.APP_ACCESS_KEY?.trim()) || env.NODE_ENV === 'production';
}

/**
 * Fixed-window rate limiter. In-memory, so it is per server instance — a guard
 * against accidents and casual abuse, not a distributed quota.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  take(key: string, now = Date.now()): { ok: boolean; retryAfter: number } {
    const entry = this.hits.get(key);
    if (!entry || entry.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 5000) this.prune(now);
      return { ok: true, retryAfter: 0 };
    }
    if (entry.count >= this.limit) return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000) };
    entry.count++;
    return { ok: true, retryAfter: 0 };
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k);
  }
}

export function clientIp(headers: Headers): string {
  return (headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
}
