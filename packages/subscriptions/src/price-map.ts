/**
 * D3-S1: Subscription Price Map
 *
 * Single source of truth for resolving the current price (in cents) of every
 * paid tier and reverse-looking-up Stripe price IDs.
 *
 * ARCHITECTURE (refactored 2026-04-07):
 *
 *   - **Static Stripe entity references and fallback cents** live in
 *     `./price-constants.ts`. That file has NO db imports so client components
 *     and tests can import the merged `STORE_PRICING`/`LISTER_PRICING`/etc.
 *     constants without dragging postgres into the bundle.
 *
 *   - **Pricing values** are read from `platform_settings` via
 *     `loadSubscriptionPricing()`, cached 5 minutes per process. Operators can
 *     edit them in `cfg/crosslister` and `cfg/monetization` without a deploy.
 *
 *   - **`getPricing()`** is ASYNC. It merges Stripe IDs (constants) with
 *     current cents (settings) to return a complete `PricingEntry`.
 *
 *   - **`resolveStripePriceId()` / `getStripePriceId()`** are SYNC — Stripe IDs
 *     are static config and don't need a settings read. Used by webhooks.
 *
 * Audit reference: 2026-04-07 — `hub-subscriptions` audit found
 *                  price-map hardcoded all 14 tier prices instead of
 *                  reading from platform_settings (per FP-010 pattern).
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import {
  STORE_STATIC,
  LISTER_STATIC,
  FINANCE_STATIC,
  AUTOMATION_STATIC,
  BUNDLE_STATIC,
  FALLBACK_STORE_CENTS,
  FALLBACK_LISTER_CENTS,
  FALLBACK_FINANCE_CENTS,
  FALLBACK_AUTOMATION_CENTS,
  FALLBACK_BUNDLE_CENTS,
} from './price-constants';
import type {
  PaidStoreTier,
  PaidListerTier,
  PaidFinanceTier,
  BundleTier,
  PricingEntry,
  CentsPair,
  StaticEntry,
  BillingInterval,
  SubscriptionProduct,
} from './price-constants';

// ─── Re-exports (preserve previous public surface) ──────────────────────────

export {
  STORE_STATIC,
  LISTER_STATIC,
  FINANCE_STATIC,
  AUTOMATION_STATIC,
  BUNDLE_STATIC,
  STORE_PRICING,
  LISTER_PRICING,
  FINANCE_PRICING,
  AUTOMATION_PRICING,
  BUNDLE_PRICING,
} from './price-constants';
export type {
  BillingInterval,
  PaidStoreTier,
  PaidListerTier,
  PaidFinanceTier,
  BundleTier,
  PricingEntry,
  BundleEntry,
  SubscriptionProduct,
} from './price-constants';

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

  // 20 reads in parallel
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

// ─── Helper Functions ────────────────────────────────────────────────────────

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
