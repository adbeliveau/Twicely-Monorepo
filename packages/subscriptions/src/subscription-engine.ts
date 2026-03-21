/**
 * D3-S1: Subscription Engine (Pure Functions)
 *
 * Change classification, preview, and billing interval lookup.
 * All tier ordering/comparison/eligibility exported from subscription-engine-core.ts.
 * NO DATABASE ACCESS — pure functions only.
 */

import { getPricing, resolveStripePriceId } from './price-map';
import type { BillingInterval } from './price-map';
import { getListerDowngradeWarnings } from './lister-downgrade-warnings';
import {
  compareStoreTiers,
  compareListerTiers,
  compareBundleTiers,
  getDowngradeWarnings,
} from './subscription-engine-core';
import type { DowngradeWarning } from './subscription-engine-core';
import type { StoreTier, ListerTier, BundleTier } from '@/types/enums';

// ─── Re-export everything from core so existing imports continue to work ─────

export {
  STORE_TIER_ORDER,
  LISTER_TIER_ORDER,
  BUNDLE_TIER_ORDER,
  compareStoreTiers,
  compareListerTiers,
  compareBundleTiers,
  isPaidStoreTier,
  isPaidListerTier,
  canSubscribeToStoreTier,
  getDowngradeWarnings,
} from './subscription-engine-core';

export type {
  StoreEligibility,
  DowngradeContext,
  DowngradeWarning,
} from './subscription-engine-core';

// ─── Change Classification ──────────────────────────────────────────────────

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

/**
 * Classify a subscription change. Tier direction takes priority over interval direction.
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
        : compareFinnTiers(targetTier, currentTier);

  if (tierDiff > 0) return 'UPGRADE';
  if (tierDiff < 0) return 'DOWNGRADE';

  // Same tier, different interval
  if (currentInterval === 'monthly' && targetInterval === 'annual') return 'INTERVAL_UPGRADE';
  return 'INTERVAL_DOWNGRADE';
}

/** Simple finance tier comparison (FREE < PRO) */
function compareFinnTiers(a: string, b: string): number {
  const order = ['FREE', 'PRO'];
  return order.indexOf(a) - order.indexOf(b);
}

export interface ChangePreview {
  classification: ChangeClassification;
  currentPriceCents: number;
  targetPriceCents: number;
  savingsPerMonthCents: number;
  effectiveDate: 'immediate' | Date;
  warnings: DowngradeWarning[];
}

/**
 * Build a preview of what a subscription change will look like.
 */
export function getChangePreview(req: ChangeRequest & { currentPeriodEnd: Date }): ChangePreview {
  const classification = classifySubscriptionChange(req);

  const currentPricing = getPricing(req.product, req.currentTier);
  const targetPricing = getPricing(req.product, req.targetTier);

  const currentMonthly = req.currentInterval === 'monthly'
    ? (currentPricing?.monthlyCents ?? 0)
    : (currentPricing?.annualMonthlyCents ?? 0);
  const targetMonthly = req.targetInterval === 'monthly'
    ? (targetPricing?.monthlyCents ?? 0)
    : (targetPricing?.annualMonthlyCents ?? 0);

  const isImmediate = classification === 'UPGRADE' || classification === 'INTERVAL_UPGRADE';
  const effectiveDate: 'immediate' | Date = isImmediate ? 'immediate' : req.currentPeriodEnd;

  const warnings =
    (classification === 'DOWNGRADE' && req.product === 'store')
      ? getDowngradeWarnings({
          currentStoreTier: req.currentTier as StoreTier,
          targetStoreTier: req.targetTier as StoreTier,
        })
      : (classification === 'DOWNGRADE' && req.product === 'lister')
        ? getListerDowngradeWarnings({
            currentListerTier: req.currentTier as ListerTier,
            targetListerTier: req.targetTier as ListerTier,
            currentPublishUsage: 0,
            currentRolloverBalance: 0,
            connectedPlatformCount: 0,
          })
        : [];

  return {
    classification,
    currentPriceCents: currentMonthly,
    targetPriceCents: targetMonthly,
    savingsPerMonthCents: currentMonthly - targetMonthly,
    effectiveDate,
    warnings,
  };
}

/**
 * Reverse lookup: given a Stripe price ID, return the billing interval.
 */
export function getBillingIntervalFromPriceId(stripePriceId: string): BillingInterval | null {
  const resolved = resolveStripePriceId(stripePriceId);
  return resolved?.interval ?? null;
}

// ─── Bundle Resolution (re-export from bundle-resolution.ts) ────────────────

export { resolveBundleEntitlements, resolveBundleComponents, getBundleSavingsCents, BUNDLE_COMPONENTS } from './bundle-resolution';
export type { BundleEntitlements, BundleComponents } from './bundle-resolution';

// ─── Lister Downgrade Warnings (re-export) ──────────────────────────────────

export { getListerDowngradeWarnings } from './lister-downgrade-warnings';
export type { ListerDowngradeContext, ListerDowngradeWarning } from './lister-downgrade-warnings';
