/**
 * D3-S1: Subscription Price Map
 *
 * Single source of truth for mapping Twicely tiers to Stripe products and
 * for resolving the current price (in cents) of every paid tier.
 *
 * ARCHITECTURE (refactored 2026-04-07 — see audit report 2026-04-07):
 *
 *   - **Stripe entity references** (`stripeProductId`, `stripePriceId*`) are
 *     STATIC config — they come from the Stripe Dashboard and don't change
 *     at runtime. Stored as constants in this file. Used by `resolveStripePriceId`
 *     which stays SYNC for fast webhook lookup.
 *
 *   - **Pricing values** (`monthlyCents`, `annualMonthlyCents`) are read from
 *     `platform_settings` via `loadPricingFromSettings()`, cached 5 minutes per
 *     process. Operators can edit them in cfg/crosslister and cfg/monetization
 *     without a deploy. The constants here are FALLBACK defaults only — they
 *     fire if the DB is unreachable.
 *
 *   - **`getPricing()`** is now ASYNC. It merges Stripe IDs (constants) with
 *     current cents (settings) to return a complete `PricingEntry`.
 *
 * Audit reference: 2026-04-07 — `hub-subscriptions` audit found
 *                  price-map hardcodes all 14 tier prices instead of
 *                  reading from platform_settings (per FP-010 pattern).
 */

import type { StoreTier, ListerTier, FinanceTier } from '@twicely/db/types';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

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
  /** Monthly price in cents (when billed monthly) — from platform_settings */
  monthlyCents: number;
  /** Monthly price in cents (when billed annually) — from platform_settings */
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

// ─── Stripe Static Config (Stripe Product/Price IDs + display names) ────────
//
// These are NOT pricing values — they're references to entities defined in the
// Stripe Dashboard. They never change at runtime and are not in platform_settings.

interface StaticEntry {
  stripeProductId: string;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  displayName: string;
}

const STORE_STATIC: Record<PaidStoreTier, StaticEntry> = {
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

const LISTER_STATIC: Record<PaidListerTier, StaticEntry> = {
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

const FINANCE_STATIC: Record<PaidFinanceTier, StaticEntry> = {
  PRO: {
    stripeProductId: 'prod_finance_pro',
    stripePriceIdMonthly: 'price_finance_pro_monthly',
    stripePriceIdAnnual: 'price_finance_pro_annual',
    displayName: 'Finance Pro',
  },
};

const AUTOMATION_STATIC: StaticEntry = {
  stripeProductId: 'prod_automation',
  stripePriceIdMonthly: 'price_automation_monthly',
  stripePriceIdAnnual: 'price_automation_annual',
  displayName: 'Automation',
};

interface BundleStaticEntry extends StaticEntry {
  includes: BundleEntry['includes'];
}

const BUNDLE_STATIC: Record<BundleTier, BundleStaticEntry> = {
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
//
// Used only when platform_settings is unreachable. Authoritative values live
// in platform_settings under store.pricing.*, crosslister.pricing.*,
// finance.pricing.*, automation.pricing.*, bundle.*. (FP-010 pattern.)

interface CentsPair {
  monthlyCents: number;
  annualMonthlyCents: number;
}

const FALLBACK_STORE_CENTS: Record<PaidStoreTier, CentsPair> = {
  STARTER: { monthlyCents: 1200, annualMonthlyCents: 699 },
  PRO: { monthlyCents: 3999, annualMonthlyCents: 2999 },
  POWER: { monthlyCents: 7999, annualMonthlyCents: 5999 },
};

const FALLBACK_LISTER_CENTS: Record<PaidListerTier, CentsPair> = {
  LITE: { monthlyCents: 1399, annualMonthlyCents: 999 },
  PRO: { monthlyCents: 3999, annualMonthlyCents: 2999 },
};

const FALLBACK_FINANCE_CENTS: Record<PaidFinanceTier, CentsPair> = {
  PRO: { monthlyCents: 1499, annualMonthlyCents: 1199 },
};

const FALLBACK_AUTOMATION_CENTS: CentsPair = {
  monthlyCents: 1299,
  annualMonthlyCents: 999,
};

const FALLBACK_BUNDLE_CENTS: Record<BundleTier, CentsPair> = {
  STARTER: { monthlyCents: 2499, annualMonthlyCents: 1799 },
  PRO: { monthlyCents: 7499, annualMonthlyCents: 5999 },
  POWER: { monthlyCents: 10999, annualMonthlyCents: 8999 },
};

// ─── Cached Pricing Loader ──────────────────────────────────────────────────

interface LoadedPricing {
  store: Record<PaidStoreTier, CentsPair>;
  lister: Record<PaidListerTier, CentsPair>;
  finance: Record<PaidFinanceTier, CentsPair>;
  automation: CentsPair;
  bundle: Record<BundleTier, CentsPair>;
}

let pricingCache: LoadedPricing | null = null;
let pricingCacheExpiresAt = 0;
const PRICING_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load all subscription pricing from platform_settings.
 * Cached 5 minutes per process. Operators edit prices in cfg/monetization
 * (or via direct settings update); changes take effect after the cache
 * expires (or call resetSubscriptionPricingCache()).
 */
export async function loadSubscriptionPricing(): Promise<LoadedPricing> {
  const now = Date.now();
  if (pricingCache && now < pricingCacheExpiresAt) {
    return pricingCache;
  }

  // 14 reads in parallel
  const [
    storeStarterMonthly, storeStarterAnnual,
    storeProMonthly, storeProAnnual,
    storePowerMonthly, storePowerAnnual,
    listerLiteMonthly, listerLiteAnnual,
    listerProMonthly, listerProAnnual,
    financeProMonthly, financeProAnnual,
    automationMonthly, automationAnnual,
    bundleStarterMonthly, bundleStarterAnnual,
    bundleProMonthly, bundleProAnnual,
    bundlePowerMonthly, bundlePowerAnnual,
  ] = await Promise.all([
    getPlatformSetting<number>('store.pricing.starter.monthlyCents', FALLBACK_STORE_CENTS.STARTER.monthlyCents),
    getPlatformSetting<number>('store.pricing.starter.annualCents', FALLBACK_STORE_CENTS.STARTER.annualMonthlyCents),
    getPlatformSetting<number>('store.pricing.pro.monthlyCents', FALLBACK_STORE_CENTS.PRO.monthlyCents),
    getPlatformSetting<number>('store.pricing.pro.annualCents', FALLBACK_STORE_CENTS.PRO.annualMonthlyCents),
    getPlatformSetting<number>('store.pricing.power.monthlyCents', FALLBACK_STORE_CENTS.POWER.monthlyCents),
    getPlatformSetting<number>('store.pricing.power.annualCents', FALLBACK_STORE_CENTS.POWER.annualMonthlyCents),
    getPlatformSetting<number>('crosslister.pricing.lite.monthlyCents', FALLBACK_LISTER_CENTS.LITE.monthlyCents),
    getPlatformSetting<number>('crosslister.pricing.lite.annualCents', FALLBACK_LISTER_CENTS.LITE.annualMonthlyCents),
    getPlatformSetting<number>('crosslister.pricing.pro.monthlyCents', FALLBACK_LISTER_CENTS.PRO.monthlyCents),
    getPlatformSetting<number>('crosslister.pricing.pro.annualCents', FALLBACK_LISTER_CENTS.PRO.annualMonthlyCents),
    getPlatformSetting<number>('finance.pricing.pro.monthlyCents', FALLBACK_FINANCE_CENTS.PRO.monthlyCents),
    getPlatformSetting<number>('finance.pricing.pro.annualCents', FALLBACK_FINANCE_CENTS.PRO.annualMonthlyCents),
    getPlatformSetting<number>('automation.pricing.monthlyCents', FALLBACK_AUTOMATION_CENTS.monthlyCents),
    getPlatformSetting<number>('automation.pricing.annualCents', FALLBACK_AUTOMATION_CENTS.annualMonthlyCents),
    getPlatformSetting<number>('bundle.starter.monthlyCents', FALLBACK_BUNDLE_CENTS.STARTER.monthlyCents),
    getPlatformSetting<number>('bundle.starter.annualCents', FALLBACK_BUNDLE_CENTS.STARTER.annualMonthlyCents),
    getPlatformSetting<number>('bundle.pro.monthlyCents', FALLBACK_BUNDLE_CENTS.PRO.monthlyCents),
    getPlatformSetting<number>('bundle.pro.annualCents', FALLBACK_BUNDLE_CENTS.PRO.annualMonthlyCents),
    getPlatformSetting<number>('bundle.power.monthlyCents', FALLBACK_BUNDLE_CENTS.POWER.monthlyCents),
    getPlatformSetting<number>('bundle.power.annualCents', FALLBACK_BUNDLE_CENTS.POWER.annualMonthlyCents),
  ]);

  pricingCache = {
    store: {
      STARTER: { monthlyCents: storeStarterMonthly, annualMonthlyCents: storeStarterAnnual },
      PRO: { monthlyCents: storeProMonthly, annualMonthlyCents: storeProAnnual },
      POWER: { monthlyCents: storePowerMonthly, annualMonthlyCents: storePowerAnnual },
    },
    lister: {
      LITE: { monthlyCents: listerLiteMonthly, annualMonthlyCents: listerLiteAnnual },
      PRO: { monthlyCents: listerProMonthly, annualMonthlyCents: listerProAnnual },
    },
    finance: {
      PRO: { monthlyCents: financeProMonthly, annualMonthlyCents: financeProAnnual },
    },
    automation: { monthlyCents: automationMonthly, annualMonthlyCents: automationAnnual },
    bundle: {
      STARTER: { monthlyCents: bundleStarterMonthly, annualMonthlyCents: bundleStarterAnnual },
      PRO: { monthlyCents: bundleProMonthly, annualMonthlyCents: bundleProAnnual },
      POWER: { monthlyCents: bundlePowerMonthly, annualMonthlyCents: bundlePowerAnnual },
    },
  };
  pricingCacheExpiresAt = now + PRICING_CACHE_TTL_MS;

  return pricingCache;
}

/** Reset the in-process pricing cache (test helper / hot-reload helper). */
export function resetSubscriptionPricingCache(): void {
  pricingCache = null;
  pricingCacheExpiresAt = 0;
}

// ─── Backwards-compat exports (re-build from fallback constants only) ───────
//
// These exports preserve the previous shape for code that still imports the
// constants directly (Stripe webhooks for resolveStripePriceId, tests, etc.).
// They use FALLBACK cents — DO NOT use these for displaying prices to users.
// For display, use getPricing() which reads from settings.

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

// ─── Helper Functions ────────────────────────────────────────────────────────

export type SubscriptionProduct = 'store' | 'lister' | 'finance' | 'automation' | 'bundle';

/**
 * Look up a pricing entry by product type and tier.
 * **ASYNC** — reads current cents from platform_settings (cached 5 min).
 * Returns null for free/none tiers or unknown combos.
 */
export async function getPricing(product: SubscriptionProduct, tier: string): Promise<PricingEntry | null> {
  const loaded = await loadSubscriptionPricing();
  switch (product) {
    case 'store': {
      if (tier in STORE_STATIC) {
        const t = tier as PaidStoreTier;
        return { ...STORE_STATIC[t], ...loaded.store[t] };
      }
      return null;
    }
    case 'lister': {
      if (tier in LISTER_STATIC) {
        const t = tier as PaidListerTier;
        return { ...LISTER_STATIC[t], ...loaded.lister[t] };
      }
      return null;
    }
    case 'finance': {
      if (tier in FINANCE_STATIC) {
        const t = tier as PaidFinanceTier;
        return { ...FINANCE_STATIC[t], ...loaded.finance[t] };
      }
      return null;
    }
    case 'automation': {
      return { ...AUTOMATION_STATIC, ...loaded.automation };
    }
    case 'bundle': {
      if (tier in BUNDLE_STATIC) {
        const t = tier as BundleTier;
        return { ...BUNDLE_STATIC[t], ...loaded.bundle[t] };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Get the Stripe Price ID for a product/tier/interval combo.
 * **SYNC** — Stripe IDs are static config and don't need a settings read.
 * Returns null if no paid tier exists.
 */
export function getStripePriceId(
  product: SubscriptionProduct,
  tier: string,
  interval: BillingInterval
): string | null {
  let staticEntry: StaticEntry | null = null;
  switch (product) {
    case 'store':
      staticEntry = tier in STORE_STATIC ? STORE_STATIC[tier as PaidStoreTier] : null;
      break;
    case 'lister':
      staticEntry = tier in LISTER_STATIC ? LISTER_STATIC[tier as PaidListerTier] : null;
      break;
    case 'finance':
      staticEntry = tier in FINANCE_STATIC ? FINANCE_STATIC[tier as PaidFinanceTier] : null;
      break;
    case 'automation':
      staticEntry = AUTOMATION_STATIC;
      break;
    case 'bundle':
      staticEntry = tier in BUNDLE_STATIC ? BUNDLE_STATIC[tier as BundleTier] : null;
      break;
  }
  if (!staticEntry) return null;
  return interval === 'monthly' ? staticEntry.stripePriceIdMonthly : staticEntry.stripePriceIdAnnual;
}

/**
 * Given a Stripe Price ID, reverse-lookup which product + tier + interval it belongs to.
 * **SYNC** — uses static Stripe ID maps.
 * Returns null if not found.
 */
export function resolveStripePriceId(priceId: string): {
  product: SubscriptionProduct;
  tier: string;
  interval: BillingInterval;
} | null {
  for (const [tier, entry] of Object.entries(STORE_STATIC)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'store', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'store', tier, interval: 'annual' };
  }
  for (const [tier, entry] of Object.entries(LISTER_STATIC)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'lister', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'lister', tier, interval: 'annual' };
  }
  for (const [tier, entry] of Object.entries(FINANCE_STATIC)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'finance', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'finance', tier, interval: 'annual' };
  }
  if (AUTOMATION_STATIC.stripePriceIdMonthly === priceId) return { product: 'automation', tier: 'DEFAULT', interval: 'monthly' };
  if (AUTOMATION_STATIC.stripePriceIdAnnual === priceId) return { product: 'automation', tier: 'DEFAULT', interval: 'annual' };
  for (const [tier, entry] of Object.entries(BUNDLE_STATIC)) {
    if (entry.stripePriceIdMonthly === priceId) return { product: 'bundle', tier, interval: 'monthly' };
    if (entry.stripePriceIdAnnual === priceId) return { product: 'bundle', tier, interval: 'annual' };
  }
  return null;
}

/**
 * Get the display price for a tier (formatted string like "$29.99/mo").
 * **ASYNC** — reads current cents from settings.
 */
export async function formatTierPrice(
  product: SubscriptionProduct,
  tier: string,
  interval: BillingInterval
): Promise<string> {
  const pricing = await getPricing(product, tier);
  if (!pricing) return '$0.00/mo';
  const cents = interval === 'monthly' ? pricing.monthlyCents : pricing.annualMonthlyCents;
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}/mo`;
}

/**
 * Calculate annual savings percentage vs monthly.
 * **ASYNC** — reads current cents from settings.
 * Returns 0 if no savings or tier doesn't exist.
 */
export async function getAnnualSavingsPercent(product: SubscriptionProduct, tier: string): Promise<number> {
  const pricing = await getPricing(product, tier);
  if (!pricing || pricing.monthlyCents === 0) return 0;
  const savings = pricing.monthlyCents - pricing.annualMonthlyCents;
  return Math.round((savings / pricing.monthlyCents) * 100);
}
