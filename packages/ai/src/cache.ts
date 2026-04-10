/**
 * AI Response Cache
 *
 * Valkey-backed cache with TTL per feature type.
 * Key pattern: ai:cache:{type}:{sha256(parts)}
 * Falls back to null (no cache) if Valkey is unavailable.
 *
 * Three-tier caching:
 * 1. Embedding cache: TTL 7 days (deterministic output)
 * 2. Completion cache: TTL 1 hour (only temp <= 0.1)
 * 3. Vision cache: TTL 24 hours (image analysis)
 */

import { createHash } from 'crypto';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

export type CacheType = 'embed' | 'completion' | 'vision';

/**
 * Generate a deterministic cache key from type and input parts.
 */
export function cacheKey(type: string, ...parts: string[]): string {
  const raw = parts.join('|');
  const hash = createHash('sha256').update(raw).digest('hex');
  return `ai:cache:${type}:${hash}`;
}

/**
 * Get a cached AI response. Returns null on cache miss or Valkey unavailability.
 */
export async function getCached(type: CacheType, key: string): Promise<string | null> {
  try {
    const client = getValkeyClient();
    const result = await client.get(key);
    if (result !== null) {
      logger.debug('[ai:cache] HIT', { type, key: key.slice(0, 40) });
    }
    return result;
  } catch (err) {
    logger.warn('[ai:cache] GET failed, treating as miss', {
      type,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Store an AI response in cache with TTL.
 */
export async function setCached(
  type: CacheType,
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    const client = getValkeyClient();
    await client.set(key, value, 'EX', ttlSeconds);
    logger.debug('[ai:cache] SET', { type, key: key.slice(0, 40), ttlSeconds });
  } catch (err) {
    logger.warn('[ai:cache] SET failed', {
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate a cached entry.
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const client = getValkeyClient();
    await client.del(key);
  } catch (err) {
    logger.warn('[ai:cache] DEL failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
