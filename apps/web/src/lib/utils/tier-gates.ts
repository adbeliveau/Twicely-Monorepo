/**
 * Store tier comparison utilities for feature gating.
 * Used to determine which features a seller can access based on their store tier.
 */

const STORE_TIER_LEVELS: Record<string, number> = {
  NONE: 0,
  STARTER: 1,
  PRO: 2,
  POWER: 3,
  ENTERPRISE: 4,
};

/** Returns true if currentTier >= requiredTier */
export function hasStoreTier(currentTier: string, requiredTier: string): boolean {
  return (STORE_TIER_LEVELS[currentTier] ?? 0) >= (STORE_TIER_LEVELS[requiredTier] ?? 0);
}

/** Returns the next tier name for upgrade CTA, or null if at max */
export function getNextTierName(currentTier: string): string | null {
  const level = STORE_TIER_LEVELS[currentTier] ?? 0;
  const entries = Object.entries(STORE_TIER_LEVELS);
  const next = entries.find(([, v]) => v === level + 1);
  return next ? next[0] : null;
}

/** Tier-gated storefront features */
export type StoreTierGatedFeature =
  | 'announcement'
  | 'socialLinks'
  | 'customCategories'
  | 'puckEditor'
  | 'promotions'
  | 'boosting';

const FEATURE_MIN_TIER: Record<StoreTierGatedFeature, string> = {
  announcement: 'STARTER',
  socialLinks: 'STARTER',
  customCategories: 'PRO',
  puckEditor: 'POWER',
  promotions: 'PRO',
  boosting: 'PRO',
};

/** Returns the minimum required tier name for a feature */
export function getMinTierForFeature(feature: StoreTierGatedFeature): string {
  return FEATURE_MIN_TIER[feature];
}

/** Returns true if the current tier can use the specified feature */
export function canUseFeature(currentTier: string, feature: StoreTierGatedFeature): boolean {
  return hasStoreTier(currentTier, FEATURE_MIN_TIER[feature]);
}
