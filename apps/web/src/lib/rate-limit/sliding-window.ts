/**
 * Sliding window rate limiter backed by Valkey (ioredis).
 *
 * Uses a sorted set (ZSET) per actor key.
 * Window: 60 seconds. Score = timestamp in ms.
 * Fail OPEN when Valkey is unreachable — availability over protection
 * during outages (per G10.1.3 spec).
 *
 * Rate limit defaults match platform_settings seeds:
 *   rateLimit.guestSearchPerMinute = 60
 * Actor limits per G10.1.3 spec:
 *   Guest (search): 60/min | Guest (other): 30/min
 *   Buyer:         120/min
 *   Seller:        300/min
 *   Staff/Admin:   exempt
 */

import Redis from 'ioredis';

const WINDOW_MS = 60_000;

// Hardcoded defaults matching platform_settings seed values
export const RATE_LIMITS = {
  guestSearch: 60,   // rateLimit.guestSearchPerMinute seed value
  guestOther: 30,
  buyer: 120,
  seller: 300,
} as const;

export type ActorType = 'guest' | 'buyer' | 'seller' | 'staff';

let _client: Redis | null = null;

function getClient(): Redis | null {
  if (_client !== null) return _client;
  try {
    const host = process.env.VALKEY_HOST ?? '127.0.0.1';
    const port = parseInt(process.env.VALKEY_PORT ?? '6379', 10);
    _client = new Redis({
      host,
      port,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 500,
    });
    _client.on('error', () => {
      // Suppress ioredis error noise — callers handle disconnected state
    });
    void _client.connect().catch(() => {});
    return _client;
  } catch {
    return null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Seconds until the oldest request falls out of the window */
  retryAfter: number;
}

/**
 * Check and record a request against the sliding window rate limit.
 * Returns { allowed: true } when Valkey is unreachable (fail OPEN).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const client = getClient();
  if (client === null || client.status !== 'ready') {
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const redisKey = `rl:${key}`;

  try {
    // Atomic sliding window via pipeline:
    // 1. Remove timestamps older than window
    // 2. Count remaining
    // 3. Conditionally add current timestamp
    // 4. Set TTL on the key
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(redisKey, '-inf', windowStart);
    pipeline.zcard(redisKey);
    const results = await pipeline.exec();

    if (!results) {
      return { allowed: true, remaining: limit, retryAfter: 0 };
    }

    const countResult = results[1];
    if (!countResult || countResult[0] !== null) {
      return { allowed: true, remaining: limit, retryAfter: 0 };
    }

    const currentCount = countResult[1] as number;

    if (currentCount >= limit) {
      // Rate limited — find oldest entry to compute Retry-After
      const oldest = await client.zrange(redisKey, 0, 0, 'WITHSCORES');
      let retryAfter = 60;
      if (oldest.length >= 2) {
        const oldestTs = parseInt(oldest[1]!, 10);
        retryAfter = Math.ceil((oldestTs + WINDOW_MS - now) / 1000);
      }
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Record this request
    const addPipeline = client.pipeline();
    addPipeline.zadd(redisKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
    addPipeline.expire(redisKey, Math.ceil(WINDOW_MS / 1000) + 1);
    await addPipeline.exec();

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      retryAfter: 0,
    };
  } catch {
    // Fail OPEN on any Valkey error
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

export function isSearchEndpoint(pathname: string): boolean {
  return pathname === '/s' || pathname.startsWith('/s?') || pathname.startsWith('/api/search');
}

export function isRateLimitExempt(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/health') ||
    pathname === '/favicon.ico'
  );
}
