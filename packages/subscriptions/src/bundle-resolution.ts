/**
 * D3-S1/S5: Bundle Resolution (Pure Functions)
 *
 * Maps bundle tiers to their individual entitlements and component tiers.
 */

import type { StoreTier, ListerTier, BundleTier } from '@twicely/db/types';
import { getPricing } from './price-map';
import type { BillingInterval } from './price-map';
import { BUNDLE_COMPONENTS, type BundleComponents } from './bundle-components';

// Re-export for callers that use this file as the entry point.
export { BUNDLE_COMPONENTS };
export type { BundleComponents };

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BundleEntitlements {
  storeTier: StoreTier;
  listerTier: ListerTier | null;
  hasFinancePro: boolean;
  hasAutomation: boolean;
}

// ─── Functions ──────────────────────────────────────────────────────────────

/** Resolve component tiers for a bundle tier. */
export function resolveBundleComponents(tier: BundleTier): BundleComponents {
  return BUNDLE_COMPONENTS[tier];
}

/**
 * Calculate savings in cents when buying a bundle vs individual subscriptions.
 * Returns positive = cheaper as bundle, negative = cheaper individually.
 *
 * Async because getPricing() reads from platform_settings.
 */
export async function getBundleSavingsCents(tier: BundleTier, interval: BillingInterval): Promise<number> {
  if (tier === 'NONE') return 0;
  const components = BUNDLE_COMPONENTS[tier];
  let sumCents = 0;

  const storePricing = await getPricing('store', components.storeTier);
  if (storePricing) {
    sumCents += interval === 'monthly' ? storePricing.monthlyCents : storePricing.annualMonthlyCents;
  }

  if (components.listerTier !== 'NONE') {
    const listerPricing = await getPricing('lister', components.listerTier);
    if (listerPricing) {
      sumCents += interval === 'monthly' ? listerPricing.monthlyCents : listerPricing.annualMonthlyCents;
    }
  }

  if (components.financeTier === 'PRO') {
    const financePricing = await getPricing('finance', 'PRO');
    if (financePricing) {
      sumCents += interval === 'monthly' ? financePricing.monthlyCents : financePricing.annualMonthlyCents;
    }
  }

  if (components.hasAutomation) {
    const automationPricing = await getPricing('automation', 'DEFAULT');
    if (automationPricing) {
      sumCents += interval === 'monthly' ? automationPricing.monthlyCents : automationPricing.annualMonthlyCents;
    }
  }

  const bundlePricing = await getPricing('bundle', tier);
  if (!bundlePricing) return 0;
  const bundleCents = interval === 'monthly' ? bundlePricing.monthlyCents : bundlePricing.annualMonthlyCents;

  return sumCents - bundleCents;
}

/**
 * Resolve what entitlements a bundle tier provides.
 */
export function resolveBundleEntitlements(bundleTier: string): BundleEntitlements | null {
  switch (bundleTier) {
    case 'STARTER':
      return {
        storeTier: 'STARTER',
        listerTier: null,
        hasFinancePro: true,
        hasAutomation: false,
      };
    case 'PRO':
      return {
        storeTier: 'PRO',
        listerTier: 'PRO',
        hasFinancePro: true,
        hasAutomation: false,
      };
    case 'POWER':
      return {
        storeTier: 'POWER',
        listerTier: 'PRO',
        hasFinancePro: true,
        hasAutomation: true,
      };
    default:
      return null;
  }
}
