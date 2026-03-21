/**
 * Tier weight multipliers for the fairness quota.
 * Higher ListerTier subscribers get a larger quota slice per window.
 * Spec: Lister Canonical §8.1
 *
 * Multipliers are applied to the base quota (crosslister.fairness.maxJobsPerSellerPerMinute).
 * Example: base=10, NONE multiplier=0.5 → 5 jobs/min
 *          base=10, PRO multiplier=3.0 → 30 jobs/min
 *
 * Runtime values read from platform_settings with 60-second cache.
 * Falls back to hardcoded defaults if setting is missing.
 */

import type { ListerTier } from '@/types/enums';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

/** Hardcoded fallback weights — overridden by platform_settings at runtime. */
const DEFAULT_TIER_WEIGHT: Record<ListerTier, number> = {
  NONE: 0.5,
  FREE: 1.0,
  LITE: 1.5,
  PRO:  3.0,
};

let cachedWeights: Record<ListerTier, number> | null = null;
let cacheExpiresAt = 0;

const TIER_KEYS: ListerTier[] = ['NONE', 'FREE', 'LITE', 'PRO'];
const SETTING_PREFIX = 'crosslister.tierWeight.';

/**
 * Load tier weights from platform_settings. Cached for 60 seconds.
 */
export async function loadTierWeights(): Promise<Record<ListerTier, number>> {
  const now = Date.now();
  if (cachedWeights && now < cacheExpiresAt) return cachedWeights;

  const weights = { ...DEFAULT_TIER_WEIGHT };

  for (const tier of TIER_KEYS) {
    const key = `${SETTING_PREFIX}${tier.toLowerCase()}`;
    const val = await getPlatformSetting<number>(key, DEFAULT_TIER_WEIGHT[tier]);
    if (typeof val === 'number' && val > 0) {
      weights[tier] = val;
    }
  }

  cachedWeights = weights;
  cacheExpiresAt = now + 60_000;
  return weights;
}

/**
 * Compute effective quota for a seller given their ListerTier.
 * Always returns a minimum of 1 to ensure no seller is completely starved.
 */
export function effectiveQuota(baseQuota: number, tier: ListerTier): number {
  const weight = cachedWeights?.[tier] ?? DEFAULT_TIER_WEIGHT[tier] ?? 1.0;
  return Math.max(1, Math.floor(baseQuota * weight));
}

/** Synchronous access to default weights (used in tests). */
export function getDefaultWeights(): Record<ListerTier, number> {
  return { ...DEFAULT_TIER_WEIGHT };
}

/** Reset cache (tests only). */
export function resetTierWeightCache(): void {
  cachedWeights = null;
  cacheExpiresAt = 0;
}
