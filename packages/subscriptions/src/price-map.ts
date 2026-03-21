/**
 * D3-S1: Subscription Price Map
 *
 * Single source of truth for mapping Twicely tiers to Stripe product/price IDs.
 * NOTE: Stripe price IDs are PLACEHOLDERS. They will be replaced with real IDs
 * when products are created in the Stripe Dashboard.
 */

import type { StoreTier, ListerTier, FinanceTier } from '@/types/enums';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BillingInterval = 'monthly' | 'annual';

/** Paid Store tiers (excludes NONE and ENTERPRISE which don't use standard Stripe flows) */
export type PaidStoreTier = Exclude<StoreTier, 'NONE' | 'ENTERPRISE'>;

/** Paid Lister tiers (excludes NONE and FREE which are unpaid) */
export type PaidListerTier = Exclude<ListerTier, 'NONE' | 'FREE'>;

/** Paid Finance tiers (excludes FREE) */
export type PaidFinanceTier = Exclude<FinanceTier, 'FREE'>;

/** Bundle tier keys */
export type BundleTier = 'STARTER' | 'PRO' | 'POWER';

export interface PricingEntry {
  /** Stripe Product ID (placeholder) */
  stripeProductId: string;
  /** Stripe Price ID for monthly billing */
  stripePriceIdMonthly: string;
  /** Stripe Price ID for annual billing */
  stripePriceIdAnnual: string;
  /** Monthly price in cents (when billed monthly) */
  monthlyCents: number;
  /** Monthly price in cents (when billed annually) */
  annualMonthlyCents: number;
  /** Display name for UI */
  displayName: string;
}

export interface BundleEntry extends PricingEntry {
  /** Which individual tiers this bundle includes */
  includes: {
    storeTier: StoreTier;
    listerTier?: ListerTier;
    financeTier: FinanceTier;
    automation?: boolean;
  };
}

// ─── Store Subscription Pricing ──────────────────────────────────────────────

export const STORE_PRICING: Record<PaidStoreTier, PricingEntry> = {
  STARTER: {
    stripeProductId: 'prod_store_starter',
    stripePriceIdMonthly: 'price_store_starter_monthly',
    stripePriceIdAnnual: 'price_store_starter_annual',
    monthlyCents: 1200,
    annualMonthlyCents: 699,
    displayName: 'Store Starter',
  },
  PRO: {
    stripeProductId: 'prod_store_pro',
    stripePriceIdMonthly: 'price_store_pro_monthly',
    stripePriceIdAnnual: 'price_store_pro_annual',
    monthlyCents: 3999,
    annualMonthlyCents: 2999,
    displayName: 'Store Pro',
  },
  POWER: {
    stripeProductId: 'prod_store_power',
    stripePriceIdMonthly: 'price_store_power_monthly',
    stripePriceIdAnnual: 'price_store_power_annual',
    monthlyCents: 7999,
    annualMonthlyCents: 5999,
    displayName: 'Store Power',
  },
  // ENTERPRISE is custom pricing — not in the map. Handled separately.
  // NONE is free — no Stripe product needed.
};

// ─── Crosslister Subscription Pricing ────────────────────────────────────────

export const LISTER_PRICING: Record<PaidListerTier, PricingEntry> = {
  LITE: {
    stripeProductId: 'prod_crosslister_lite',
    stripePriceIdMonthly: 'price_crosslister_lite_monthly',
    stripePriceIdAnnual: 'price_crosslister_lite_annual',
    monthlyCents: 1399,
    annualMonthlyCents: 999,
    displayName: 'Crosslister Lite',
  },
  PRO: {
    stripeProductId: 'prod_crosslister_pro',
    stripePriceIdMonthly: 'price_crosslister_pro_monthly',
    stripePriceIdAnnual: 'price_crosslister_pro_annual',
    monthlyCents: 3999,
    annualMonthlyCents: 2999,
    displayName: 'Crosslister Pro',
  },
  // FREE tier has no Stripe product — it's the default.
  // NONE means no crosslister at all.
};

// ─── Finance Subscription Pricing ────────────────────────────────────────────

export const FINANCE_PRICING: Record<PaidFinanceTier, PricingEntry> = {
  PRO: {
    stripeProductId: 'prod_finance_pro',
    stripePriceIdMonthly: 'price_finance_pro_monthly',
    stripePriceIdAnnual: 'price_finance_pro_annual',
    monthlyCents: 1499,
    annualMonthlyCents: 1199,
    displayName: 'Finance Pro',
  },
  // FREE is default — no Stripe product.
};

// ─── Automation Add-On Pricing ───────────────────────────────────────────────

export const AUTOMATION_PRICING: PricingEntry = {
  stripeProductId: 'prod_automation',
  stripePriceIdMonthly: 'price_automation_monthly',
  stripePriceIdAnnual: 'price_automation_annual',
  monthlyCents: 1299,
  annualMonthlyCents: 999,
  displayName: 'Automation',
};

// ─── Bundle Pricing ──────────────────────────────────────────────────────────

export const BUNDLE_PRICING: Record<BundleTier, BundleEntry> = {
  STARTER: {
    stripeProductId: 'prod_bundle_starter',
    stripePriceIdMonthly: 'price_bundle_starter_monthly',
    stripePriceIdAnnual: 'price_bundle_starter_annual',
    monthlyCents: 2499,
    annualMonthlyCents: 1799,
    displayName: 'Seller Starter Bundle',
    includes: { storeTier: 'STARTER', financeTier: 'PRO' },
  },
  PRO: {
    stripeProductId: 'prod_bundle_pro',
    stripePriceIdMonthly: 'price_bundle_pro_monthly',
    stripePriceIdAnnual: 'price_bundle_pro_annual',
    monthlyCents: 7499,
    annualMonthlyCents: 5999,
    displayName: 'Seller Pro Bundle',
    includes: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO' },
  },
  POWER: {
    stripeProductId: 'prod_bundle_power',
    stripePriceIdMonthly: 'price_bundle_power_monthly',
    stripePriceIdAnnual: 'price_bundle_power_annual',
    monthlyCents: 10999,
    annualMonthlyCents: 8999,
    displayName: 'Seller Power Bundle',
    includes: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', automation: true },
  },
};

// ─── Helper Functions ────────────────────────────────────────────────────────

export type SubscriptionProduct = 'store' | 'lister' | 'finance' | 'automation' | 'bundle';

/**
 * Look up a pricing entry by product type and tier.
 * Returns null for free/none tiers or unknown combos.
 */
export function getPricing(product: SubscriptionProduct, tier: string): PricingEntry | null {
  switch (product) {
    case 'store':
      if (tier in STORE_PRICING) {
        return STORE_PRICING[tier as PaidStoreTier];
      }
      return null;
    case 'lister':
      if (tier in LISTER_PRICING) {
        return LISTER_PRICING[tier as PaidListerTier];
      }
      return null;
    case 'finance':
      if (tier in FINANCE_PRICING) {
        return FINANCE_PRICING[tier as PaidFinanceTier];
      }
      return null;
    case 'automation':
      return AUTOMATION_PRICING;
    case 'bundle':
      if (tier in BUNDLE_PRICING) {
        return BUNDLE_PRICING[tier as BundleTier];
      }
      return null;
    default:
      return null;
  }
}

/**
 * Get the Stripe Price ID for a product/tier/interval combo.
 * Returns null if no paid tier exists.
 */
export function getStripePriceId(
  product: SubscriptionProduct,
  tier: string,
  interval: BillingInterval
): string | null {
  const pricing = getPricing(product, tier);
  if (!pricing) return null;
  return interval === 'monthly' ? pricing.stripePriceIdMonthly : pricing.stripePriceIdAnnual;
}

/**
 * Given a Stripe Price ID, reverse-lookup which product + tier + interval it belongs to.
 * Returns null if not found.
 */
export function resolveStripePriceId(priceId: string): {
  product: SubscriptionProduct;
  tier: string;
  interval: BillingInterval;
} | null {
  // Check store pricing
  for (const [tier, entry] of Object.entries(STORE_PRICING)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'store', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'store', tier, interval: 'annual' };
  }
  // Check lister pricing
  for (const [tier, entry] of Object.entries(LISTER_PRICING)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'lister', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'lister', tier, interval: 'annual' };
  }
  // Check finance pricing
  for (const [tier, entry] of Object.entries(FINANCE_PRICING)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'finance', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'finance', tier, interval: 'annual' };
  }
  // Check automation
  if (AUTOMATION_PRICING.stripePriceIdMonthly === priceId) return { product: 'automation', tier: 'DEFAULT', interval: 'monthly' };
  if (AUTOMATION_PRICING.stripePriceIdAnnual === priceId) return { product: 'automation', tier: 'DEFAULT', interval: 'annual' };
  // Check bundles
  for (const [tier, entry] of Object.entries(BUNDLE_PRICING)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'bundle', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'bundle', tier, interval: 'annual' };
  }
  return null;
}

/**
 * Get the display price for a tier (formatted string like "$29.99/mo").
 */
export function formatTierPrice(
  product: SubscriptionProduct,
  tier: string,
  interval: BillingInterval
): string {
  const pricing = getPricing(product, tier);
  if (!pricing) return '$0.00/mo';
  const cents = interval === 'monthly' ? pricing.monthlyCents : pricing.annualMonthlyCents;
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}/mo`;
}

/**
 * Calculate annual savings percentage vs monthly.
 * Returns 0 if no savings or tier doesn't exist.
 */
export function getAnnualSavingsPercent(product: SubscriptionProduct, tier: string): number {
  const pricing = getPricing(product, tier);
  if (!pricing || pricing.monthlyCents === 0) return 0;
  const savings = pricing.monthlyCents - pricing.annualMonthlyCents;
  return Math.round((savings / pricing.monthlyCents) * 100);
}
