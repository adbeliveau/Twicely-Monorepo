/**
 * D3-S1/S5: Bundle Resolution (Pure Functions)
 *
 * Maps bundle tiers to their individual entitlements and component tiers.
 */

import type { StoreTier, ListerTier, FinanceTier, BundleTier } from '@/types/enums';
import { getPricing } from '@twicely/subscriptions/price-map';
import type { BillingInterval } from '@twicely/subscriptions/price-map';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BundleEntitlements {
  storeTier: StoreTier;
  listerTier: ListerTier | null;
  hasFinancePro: boolean;
  hasAutomation: boolean;
}

export interface BundleComponents {
  storeTier: StoreTier;
  listerTier: ListerTier;
  financeTier: FinanceTier;
  hasAutomation: boolean;
}

// ─── Component Mapping ──────────────────────────────────────────────────────

export const BUNDLE_COMPONENTS: Record<BundleTier, BundleComponents> = {
  NONE: { storeTier: 'NONE', listerTier: 'NONE', financeTier: 'FREE', hasAutomation: false },
  STARTER: { storeTier: 'STARTER', listerTier: 'NONE', financeTier: 'PRO', hasAutomation: false },
  PRO: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: false },
  POWER: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: true },
};

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
