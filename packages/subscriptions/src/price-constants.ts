/**
 * Pure-data subscription price constants.
 *
 * Lives in a standalone file so client components can import the static
 * Stripe IDs + fallback cents without pulling in `price-map.ts` (which
 * imports `@twicely/db/queries/platform-settings` and would drag the
 * postgres driver into the client bundle).
 *
 * - **STORE_STATIC / LISTER_STATIC / FINANCE_STATIC / AUTOMATION_STATIC / BUNDLE_STATIC**
 *   = Stripe Product/Price IDs + display names. Never change at runtime.
 *
 * - **FALLBACK_*_CENTS** = last-resort cents values used only when
 *   `platform_settings` is unreachable. Authoritative values live in
 *   platform_settings under `store.pricing.*`, `crosslister.pricing.*`,
 *   `finance.pricing.*`, `automation.pricing.*`, `bundle.*`. (FP-010 pattern.)
 *
 * - **STORE_PRICING / LISTER_PRICING / FINANCE_PRICING / AUTOMATION_PRICING /
 *   BUNDLE_PRICING** = the merged static + fallback rows. Used by Stripe
 *   webhook lookups (sync), tests, and client tier-config rendering.
 *   For live, edit-aware prices use `getPricing()` from `price-map.ts` instead.
 */

import type { StoreTier, ListerTier, FinanceTier } from '@twicely/db/types';

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
  /** Stripe Product ID (placeholder until Stripe Dashboard products created) */
  stripeProductId: string;
  /** Stripe Price ID for monthly billing */
  stripePriceIdMonthly: string;
  /** Stripe Price ID for annual billing */
  stripePriceIdAnnual: string;
  /** Display name for UI */
  displayName: string;
  /** Monthly price in cents */
  monthlyCents: number;
  /** Annual price in cents (per-month equivalent for display) */
  annualMonthlyCents: number;
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

export type SubscriptionProduct = 'store' | 'lister' | 'finance' | 'automation' | 'bundle';

// ─── Stripe Static Config (Stripe Product/Price IDs + display names) ────────

export interface StaticEntry {
  stripeProductId: string;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  displayName: string;
}

export const STORE_STATIC: Record<PaidStoreTier, StaticEntry> = {
  STARTER: {
    stripeProductId: 'prod_store_starter',
    stripePriceIdMonthly: 'price_store_starter_monthly',
    stripePriceIdAnnual: 'price_store_starter_annual',
    displayName: 'Store Starter',
  },
  PRO: {
    stripeProductId: 'prod_store_pro',
    stripePriceIdMonthly: 'price_store_pro_monthly',
    stripePriceIdAnnual: 'price_store_pro_annual',
    displayName: 'Store Pro',
  },
  POWER: {
    stripeProductId: 'prod_store_power',
    stripePriceIdMonthly: 'price_store_power_monthly',
    stripePriceIdAnnual: 'price_store_power_annual',
    displayName: 'Store Power',
  },
};

export const LISTER_STATIC: Record<PaidListerTier, StaticEntry> = {
  LITE: {
    stripeProductId: 'prod_crosslister_lite',
    stripePriceIdMonthly: 'price_crosslister_lite_monthly',
    stripePriceIdAnnual: 'price_crosslister_lite_annual',
    displayName: 'Crosslister Lite',
  },
  PRO: {
    stripeProductId: 'prod_crosslister_pro',
    stripePriceIdMonthly: 'price_crosslister_pro_monthly',
    stripePriceIdAnnual: 'price_crosslister_pro_annual',
    displayName: 'Crosslister Pro',
  },
};

export const FINANCE_STATIC: Record<PaidFinanceTier, StaticEntry> = {
  PRO: {
    stripeProductId: 'prod_finance_pro',
    stripePriceIdMonthly: 'price_finance_pro_monthly',
    stripePriceIdAnnual: 'price_finance_pro_annual',
    displayName: 'Finance Pro',
  },
};

export const AUTOMATION_STATIC: StaticEntry = {
  stripeProductId: 'prod_automation',
  stripePriceIdMonthly: 'price_automation_monthly',
  stripePriceIdAnnual: 'price_automation_annual',
  displayName: 'Automation',
};

export interface BundleStaticEntry extends StaticEntry {
  includes: BundleEntry['includes'];
}

export const BUNDLE_STATIC: Record<BundleTier, BundleStaticEntry> = {
  STARTER: {
    stripeProductId: 'prod_bundle_starter',
    stripePriceIdMonthly: 'price_bundle_starter_monthly',
    stripePriceIdAnnual: 'price_bundle_starter_annual',
    displayName: 'Seller Starter Bundle',
    includes: { storeTier: 'STARTER', financeTier: 'PRO' },
  },
  PRO: {
    stripeProductId: 'prod_bundle_pro',
    stripePriceIdMonthly: 'price_bundle_pro_monthly',
    stripePriceIdAnnual: 'price_bundle_pro_annual',
    displayName: 'Seller Pro Bundle',
    includes: { storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO' },
  },
  POWER: {
    stripeProductId: 'prod_bundle_power',
    stripePriceIdMonthly: 'price_bundle_power_monthly',
    stripePriceIdAnnual: 'price_bundle_power_annual',
    displayName: 'Seller Power Bundle',
    includes: { storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', automation: true },
  },
};

// ─── Fallback Pricing Constants ─────────────────────────────────────────────

export interface CentsPair {
  monthlyCents: number;
  annualMonthlyCents: number;
}

export const FALLBACK_STORE_CENTS: Record<PaidStoreTier, CentsPair> = {
  STARTER: { monthlyCents: 1200, annualMonthlyCents: 699 },
  PRO: { monthlyCents: 3999, annualMonthlyCents: 2999 },
  POWER: { monthlyCents: 7999, annualMonthlyCents: 5999 },
};

export const FALLBACK_LISTER_CENTS: Record<PaidListerTier, CentsPair> = {
  LITE: { monthlyCents: 1399, annualMonthlyCents: 999 },
  PRO: { monthlyCents: 3999, annualMonthlyCents: 2999 },
};

export const FALLBACK_FINANCE_CENTS: Record<PaidFinanceTier, CentsPair> = {
  PRO: { monthlyCents: 1499, annualMonthlyCents: 1199 },
};

export const FALLBACK_AUTOMATION_CENTS: CentsPair = {
  monthlyCents: 1299,
  annualMonthlyCents: 999,
};

export const FALLBACK_BUNDLE_CENTS: Record<BundleTier, CentsPair> = {
  STARTER: { monthlyCents: 2499, annualMonthlyCents: 1799 },
  PRO: { monthlyCents: 7499, annualMonthlyCents: 5999 },
  POWER: { monthlyCents: 10999, annualMonthlyCents: 8999 },
};

// ─── Merged Pricing (static + fallback) ─────────────────────────────────────

export const STORE_PRICING: Record<PaidStoreTier, PricingEntry> = {
  STARTER: { ...STORE_STATIC.STARTER, ...FALLBACK_STORE_CENTS.STARTER },
  PRO: { ...STORE_STATIC.PRO, ...FALLBACK_STORE_CENTS.PRO },
  POWER: { ...STORE_STATIC.POWER, ...FALLBACK_STORE_CENTS.POWER },
};

export const LISTER_PRICING: Record<PaidListerTier, PricingEntry> = {
  LITE: { ...LISTER_STATIC.LITE, ...FALLBACK_LISTER_CENTS.LITE },
  PRO: { ...LISTER_STATIC.PRO, ...FALLBACK_LISTER_CENTS.PRO },
};

export const FINANCE_PRICING: Record<PaidFinanceTier, PricingEntry> = {
  PRO: { ...FINANCE_STATIC.PRO, ...FALLBACK_FINANCE_CENTS.PRO },
};

export const AUTOMATION_PRICING: PricingEntry = {
  ...AUTOMATION_STATIC,
  ...FALLBACK_AUTOMATION_CENTS,
};

export const BUNDLE_PRICING: Record<BundleTier, BundleEntry> = {
  STARTER: { ...BUNDLE_STATIC.STARTER, ...FALLBACK_BUNDLE_CENTS.STARTER },
  PRO: { ...BUNDLE_STATIC.PRO, ...FALLBACK_BUNDLE_CENTS.PRO },
  POWER: { ...BUNDLE_STATIC.POWER, ...FALLBACK_BUNDLE_CENTS.POWER },
};
