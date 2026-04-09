/**
 * Feature Flag Evaluation Service (E4 + G10.4)
 *
 * Server-side evaluation of feature flags.
 * Reads from Valkey cache first; falls back to PostgreSQL on miss.
 * Cache TTL sourced from platform setting featureFlags.cacheSeconds (default 30s).
 *
 * Evaluation order (Feature Lock-in Section 38):
 * 1. Check Valkey cache — parse and evaluate if hit
 * 2. Flag not found in DB -> false (or true for kill switch fail-open)
 * 3. BOOLEAN type -> return enabled
 * 4. PERCENTAGE type -> deterministic hash(userId + flagKey) determines bucket
 * 5. TARGETED type -> check userOverrides in targetingJson
 * 6. Fallback -> return enabled
 *
 * Kill switches (key prefix kill.*):
 *   - isKillSwitchActive returns true when feature is enabled (active)
 *   - Defaults to true (fail-open) when flag not found
 *
 * Launch gates (key prefix gate.*):
 *   - isLaunchGateOpen returns true when gate is enabled (open)
 *   - Defaults to false (fail-closed) when flag not found
 */

import { db } from '@twicely/db';
import { featureFlag } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getValkeyClient } from '@twicely/db/cache';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ─── TTL cache (avoids DB hit on every cache write) ──────────────────────────

let _cachedTtl: number | null = null;
let _ttlFetchedAt = 0;
const TTL_REFRESH_MS = 60_000; // re-read platform setting every 60s

async function getCacheTtl(): Promise<number> {
  const now = Date.now();
  if (_cachedTtl !== null && now - _ttlFetchedAt < TTL_REFRESH_MS) {
    return _cachedTtl;
  }
  _cachedTtl = await getPlatformSetting<number>('featureFlags.cacheSeconds', 30);
  _ttlFetchedAt = now;
  return _cachedTtl;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

interface FlagCachePayload {
  enabled: boolean;
  type: 'BOOLEAN' | 'PERCENTAGE' | 'TARGETED';
  percentage: number | null;
  targetingJson: unknown;
}

function cacheKey(flagKey: string): string {
  return `ff:${flagKey}`;
}

async function readFromCache(flagKey: string): Promise<FlagCachePayload | null> {
  try {
    const client = getValkeyClient();
    const raw = await client.get(cacheKey(flagKey));
    if (!raw) return null;
    return JSON.parse(raw) as FlagCachePayload;
  } catch {
    return null;
  }
}

async function writeToCache(flagKey: string, payload: FlagCachePayload): Promise<void> {
  try {
    const ttl = await getCacheTtl();
    if (ttl <= 0) return;
    const client = getValkeyClient();
    await client.set(cacheKey(flagKey), JSON.stringify(payload), 'EX', ttl);
  } catch (err) {
    logger.warn('Feature flag cache write failed', {
      flagKey,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate the Valkey cache entry for a flag key.
 * Called after toggle/update/delete actions.
 */
export async function invalidateFlagCache(flagKey: string): Promise<void> {
  try {
    const client = getValkeyClient();
    await client.del(cacheKey(flagKey));
  } catch (err) {
    logger.warn('Feature flag cache invalidation failed', {
      flagKey,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Reset the process-level TTL cache so changes to featureFlags.cacheSeconds
 * take effect immediately instead of waiting up to 60s. Called from
 * admin-settings.ts when the operator updates this specific key.
 * R5 fix (hub-platform-settings audit).
 */
export function resetTtlCache(): void {
  _cachedTtl = null;
  _ttlFetchedAt = 0;
}

// ─── Evaluation engine ────────────────────────────────────────────────────────

function evaluatePayload(
  payload: FlagCachePayload,
  context?: { userId?: string },
  flagKey?: string
): boolean {
  if (!payload.enabled) return false;

  if (payload.type === 'BOOLEAN') return true;

  if (payload.type === 'PERCENTAGE' && payload.percentage !== null) {
    if (!context?.userId) return false;
    const bucket = hashToBucket(context.userId, flagKey ?? '');
    return bucket < payload.percentage;
  }

  if (payload.type === 'TARGETED' && context?.userId) {
    const targeting = payload.targetingJson as {
      userOverrides?: Record<string, boolean>;
    };
    const override = targeting?.userOverrides?.[context.userId];
    if (override !== undefined) return override;
  }

  return payload.enabled;
}

/**
 * Check if a feature flag is enabled for a given context.
 * Reads from Valkey cache first; falls back to DB on miss.
 */
export async function isFeatureEnabled(
  flagKey: string,
  context?: { userId?: string }
): Promise<boolean> {
  // 1. Try cache
  const cached = await readFromCache(flagKey);
  if (cached !== null) {
    return evaluatePayload(cached, context, flagKey);
  }

  // 2. Fall back to DB
  try {
    const [flag] = await db
      .select()
      .from(featureFlag)
      .where(eq(featureFlag.key, flagKey))
      .limit(1);

    if (!flag) return false;

    const payload: FlagCachePayload = {
      enabled: flag.enabled,
      type: flag.type,
      percentage: flag.percentage ?? null,
      targetingJson: flag.targetingJson,
    };

    // Populate cache after DB hit (fire-and-forget)
    void writeToCache(flagKey, payload);

    return evaluatePayload(payload, context, flagKey);
  } catch (err) {
    logger.error('Feature flag DB read failed', {
      flagKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Check if a kill switch is active (feature is ENABLED).
 * Returns true if the feature should be available (kill switch is ON).
 * Returns false if the feature has been killed (kill switch is OFF).
 * If the flag does not exist, defaults to true (feature available — fail-open).
 *
 * Usage: isKillSwitchActive('checkout') checks kill.checkout
 */
export async function isKillSwitchActive(featureKey: string): Promise<boolean> {
  const fullKey = `kill.${featureKey}`;

  const cached = await readFromCache(fullKey);
  if (cached !== null) {
    return cached.enabled;
  }

  try {
    const [flag] = await db
      .select({ enabled: featureFlag.enabled, type: featureFlag.type,
                 percentage: featureFlag.percentage, targetingJson: featureFlag.targetingJson })
      .from(featureFlag)
      .where(eq(featureFlag.key, fullKey))
      .limit(1);

    if (!flag) return true; // fail-open: feature available if flag not seeded

    const payload: FlagCachePayload = {
      enabled: flag.enabled,
      type: flag.type,
      percentage: flag.percentage ?? null,
      targetingJson: flag.targetingJson,
    };

    void writeToCache(fullKey, payload);

    return flag.enabled;
  } catch (err) {
    logger.error('Kill switch DB read failed', {
      featureKey: fullKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return true; // fail-open on error
  }
}

/**
 * Check if a launch gate is open (feature is ready for production).
 * Returns true if the gate is open (enabled = true).
 * Returns false if the gate is closed (enabled = false or not found).
 *
 * Usage: isLaunchGateOpen('marketplace') checks gate.marketplace
 */
export async function isLaunchGateOpen(gateKey: string): Promise<boolean> {
  const fullKey = `gate.${gateKey}`;

  const cached = await readFromCache(fullKey);
  if (cached !== null) {
    return cached.enabled;
  }

  try {
    const [flag] = await db
      .select({ enabled: featureFlag.enabled, type: featureFlag.type,
                 percentage: featureFlag.percentage, targetingJson: featureFlag.targetingJson })
      .from(featureFlag)
      .where(eq(featureFlag.key, fullKey))
      .limit(1);

    if (!flag) return false; // fail-closed: gate not open if not seeded

    const payload: FlagCachePayload = {
      enabled: flag.enabled,
      type: flag.type,
      percentage: flag.percentage ?? null,
      targetingJson: flag.targetingJson,
    };

    void writeToCache(fullKey, payload);

    return flag.enabled;
  } catch (err) {
    logger.error('Launch gate DB read failed', {
      gateKey: fullKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return false; // fail-closed on error
  }
}

/**
 * Deterministic hash to bucket (0-99) for percentage rollout.
 * Uses FNV-1a hash for consistency — same (userId, flagKey) always returns same bucket.
 */
function hashToBucket(userId: string, flagKey: string): number {
  const input = `${userId}:${flagKey}`;
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return Math.abs(hash) % 100;
}
