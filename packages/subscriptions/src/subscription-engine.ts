/**
 * D3-S1: Subscription Engine
 *
 * Async change preview + reverse-lookup. The pure sync helpers
 * (classification, comparison, eligibility, downgrade warnings) live in
 * subscription-engine-core.ts so client components can import them without
 * dragging in price-map's postgres driver.
 */

import { getPricing, resolveStripePriceId } from './price-map';
import type { BillingInterval } from './price-map';
import { getListerDowngradeWarnings } from './lister-downgrade-warnings';
import {
  classifySubscriptionChange,
  getDowngradeWarnings,
} from './subscription-engine-core';
import type { ChangeRequest } from './subscription-engine-core';
import type { StoreTier, ListerTier } from '@twicely/db/types';

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
  classifySubscriptionChange,
} from './subscription-engine-core';

export type {
  StoreEligibility,
  DowngradeContext,
  DowngradeWarning,
  ChangeClassification,
  ChangeRequest,
} from './subscription-engine-core';

// ─── Change Preview (async — uses platform_settings via getPricing) ─────────

export type { ChangePreview } from './subscription-engine-core';
import type { ChangePreview } from './subscription-engine-core';

/**
 * Build a preview of what a subscription change will look like.
 * Async because getPricing() reads from platform_settings.
 */
export async function getChangePreview(req: ChangeRequest & { currentPeriodEnd: Date }): Promise<ChangePreview> {
  const classification = classifySubscriptionChange(req);

  const currentPricing = await getPricing(req.product, req.currentTier);
  const targetPricing = await getPricing(req.product, req.targetTier);

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
