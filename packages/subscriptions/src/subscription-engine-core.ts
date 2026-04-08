/**
 * D3-S1: Subscription Engine Core (Pure Functions)
 *
 * Tier ordering, comparison, paid-tier checks, eligibility checks, and
 * store downgrade warnings. NO DATABASE ACCESS — pure functions only.
 *
 * Consumed by subscription-engine.ts (which re-exports everything here).
 */

import type { StoreTier, ListerTier, BundleTier } from '@twicely/db/types';

// ─── Tier Ordering ──────────────────────────────────────────────────────────

/** StoreTier rank order (higher index = higher tier) */
export const STORE_TIER_ORDER: StoreTier[] = [
  'NONE',
  'STARTER',
  'PRO',
  'POWER',
  'ENTERPRISE',
];

/** ListerTier rank order (higher index = higher tier) */
export const LISTER_TIER_ORDER: ListerTier[] = ['NONE', 'FREE', 'LITE', 'PRO'];

export const BUNDLE_TIER_ORDER: BundleTier[] = ['NONE', 'STARTER', 'PRO', 'POWER'];

// ─── Tier Comparison Functions ──────────────────────────────────────────────

/**
 * Compare two StoreTiers.
 * Returns:
 *  - negative if a < b
 *  - zero if a === b
 *  - positive if a > b
 */
export function compareStoreTiers(a: StoreTier, b: StoreTier): number {
  return STORE_TIER_ORDER.indexOf(a) - STORE_TIER_ORDER.indexOf(b);
}

/**
 * Compare two ListerTiers.
 * Returns:
 *  - negative if a < b
 *  - zero if a === b
 *  - positive if a > b
 */
export function compareListerTiers(a: ListerTier, b: ListerTier): number {
  return LISTER_TIER_ORDER.indexOf(a) - LISTER_TIER_ORDER.indexOf(b);
}

/** Compare two BundleTiers. Negative if a < b, zero if equal, positive if a > b. */
export function compareBundleTiers(a: BundleTier, b: BundleTier): number {
  return BUNDLE_TIER_ORDER.indexOf(a) - BUNDLE_TIER_ORDER.indexOf(b);
}

// ─── Paid Tier Checks ───────────────────────────────────────────────────────

/**
 * Returns true if the StoreTier requires standard Stripe subscription (STARTER/PRO/POWER).
 * ENTERPRISE is custom-priced and must NOT route through standard Stripe flows.
 */
export function isPaidStoreTier(tier: StoreTier): boolean {
  return tier !== 'NONE' && tier !== 'ENTERPRISE';
}

/** Returns true if the ListerTier requires payment (LITE+) */
export function isPaidListerTier(tier: ListerTier): boolean {
  return tier === 'LITE' || tier === 'PRO';
}

// ─── Eligibility Checks ─────────────────────────────────────────────────────

export interface StoreEligibility {
  isBusinessSeller: boolean;
  hasStripeConnect: boolean;
  hasIdentityVerified: boolean;
}

/**
 * Check if user can subscribe to a paid StoreTier.
 * Business sellers with Stripe Connect + identity verification required.
 * ENTERPRISE is not self-service — must contact sales.
 */
export function canSubscribeToStoreTier(
  targetTier: StoreTier,
  eligibility: StoreEligibility
): { allowed: boolean; reason?: string } {
  // NONE tier always allowed (cancellation)
  if (targetTier === 'NONE') {
    return { allowed: true };
  }

  // ENTERPRISE is not self-service
  if (targetTier === 'ENTERPRISE') {
    return {
      allowed: false,
      reason: 'Enterprise tier requires custom pricing. Contact sales.',
    };
  }

  // All paid store tiers require BUSINESS status
  if (!eligibility.isBusinessSeller) {
    return {
      allowed: false,
      reason: 'Store subscriptions require a business seller account',
    };
  }

  // All paid store tiers require Stripe Connect
  if (!eligibility.hasStripeConnect) {
    return {
      allowed: false,
      reason: 'Stripe Connect onboarding required for store subscriptions',
    };
  }

  // All paid store tiers require identity verification
  if (!eligibility.hasIdentityVerified) {
    return {
      allowed: false,
      reason: 'Identity verification required for store subscriptions',
    };
  }

  return { allowed: true };
}

// ─── Downgrade Warnings ─────────────────────────────────────────────────────

export interface DowngradeContext {
  currentStoreTier: StoreTier;
  targetStoreTier: StoreTier;
  activeBoostCount?: number;
  hasCustomStorefront?: boolean;
  hasAutomation?: boolean;
}

export interface DowngradeWarning {
  feature: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Get warnings for downgrading from current to target tier.
 * Returns empty array if upgrade or same tier.
 */
export function getDowngradeWarnings(ctx: DowngradeContext): DowngradeWarning[] {
  const warnings: DowngradeWarning[] = [];

  // Not a downgrade
  if (compareStoreTiers(ctx.targetStoreTier, ctx.currentStoreTier) >= 0) {
    return warnings;
  }

  // Downgrading from PRO+ to below PRO loses boosting
  const currentHasBoosting = compareStoreTiers(ctx.currentStoreTier, 'PRO') >= 0;
  const targetHasBoosting = compareStoreTiers(ctx.targetStoreTier, 'PRO') >= 0;

  if (currentHasBoosting && !targetHasBoosting && (ctx.activeBoostCount ?? 0) > 0) {
    warnings.push({
      feature: 'Promoted Listings',
      message: `You have ${ctx.activeBoostCount} active boosted listing(s) that will be deactivated`,
      severity: 'warning',
    });
  }

  // Downgrading from POWER+ to below POWER loses custom storefront
  const currentHasStorefront = compareStoreTiers(ctx.currentStoreTier, 'POWER') >= 0;
  const targetHasStorefront = compareStoreTiers(ctx.targetStoreTier, 'POWER') >= 0;

  if (currentHasStorefront && !targetHasStorefront && ctx.hasCustomStorefront) {
    warnings.push({
      feature: 'Custom Storefront',
      message: 'Your custom storefront design will revert to the default template',
      severity: 'critical',
    });
  }

  // Downgrading from POWER+ to below POWER loses daily auto-payout
  if (currentHasStorefront && !targetHasStorefront) {
    warnings.push({
      feature: 'Daily Auto-Payout',
      message: 'Daily auto-payouts will be disabled. Weekly payouts remain available.',
      severity: 'info',
    });
  }

  return warnings;
}

// ─── Change Classification (pure — moved here so client components can import
// without dragging in price-map's postgres driver) ──────────────────────────

export type BillingInterval = 'monthly' | 'annual';

export type ChangeClassification =
  | 'UPGRADE'
  | 'DOWNGRADE'
  | 'INTERVAL_UPGRADE'
  | 'INTERVAL_DOWNGRADE'
  | 'NO_CHANGE'
  | 'BLOCKED';

export interface ChangeRequest {
  product: 'store' | 'lister' | 'finance' | 'bundle';
  currentTier: string;
  currentInterval: BillingInterval;
  targetTier: string;
  targetInterval: BillingInterval;
}

/** Simple finance tier comparison (FREE < PRO) */
function compareFinanceTiers(a: string, b: string): number {
  const order = ['FREE', 'PRO'];
  return order.indexOf(a) - order.indexOf(b);
}

/**
 * Result of a getChangePreview call. Defined here (not in subscription-engine.ts)
 * so client components can import the type without dragging in price-map's
 * postgres driver via the engine barrel.
 */
export interface ChangePreview {
  classification: ChangeClassification;
  currentPriceCents: number;
  targetPriceCents: number;
  savingsPerMonthCents: number;
  effectiveDate: 'immediate' | Date;
  warnings: DowngradeWarning[];
}

/**
 * Classify a subscription change. Tier direction takes priority over interval direction.
 * Pure function — no db access.
 */
export function classifySubscriptionChange(req: ChangeRequest): ChangeClassification {
  const { product, currentTier, currentInterval, targetTier, targetInterval } = req;

  if (currentTier === targetTier && currentInterval === targetInterval) return 'NO_CHANGE';
  if (targetTier === 'ENTERPRISE' || currentTier === 'ENTERPRISE') return 'BLOCKED';
  if (targetTier === 'NONE') return 'BLOCKED';

  const tierDiff = product === 'store'
    ? compareStoreTiers(targetTier as StoreTier, currentTier as StoreTier)
    : product === 'lister'
      ? compareListerTiers(targetTier as ListerTier, currentTier as ListerTier)
      : product === 'bundle'
        ? compareBundleTiers(targetTier as BundleTier, currentTier as BundleTier)
        : compareFinanceTiers(targetTier, currentTier);

  if (tierDiff > 0) return 'UPGRADE';
  if (tierDiff < 0) return 'DOWNGRADE';

  // Same tier, different interval
  if (currentInterval === 'monthly' && targetInterval === 'annual') return 'INTERVAL_UPGRADE';
  return 'INTERVAL_DOWNGRADE';
}
