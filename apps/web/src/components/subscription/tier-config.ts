/**
 * D3-S3: Subscription tier configuration for the SubscriptionOverview UI.
 *
 * Two access patterns (refactored 2026-04-07 — see Phase 3B.4):
 *
 *   1. **Sync exports** (`STORE_TIERS`, `LISTER_TIERS`, …):
 *      Built from `FALLBACK_*_PRICING` constants in price-map. Safe to import
 *      from client components and tests. Prices reflect the seed defaults — they
 *      do NOT pick up runtime edits to platform_settings. Use this for fallback
 *      paths only.
 *
 *   2. **Async loader** (`loadTierConfig()`):
 *      Reads current prices from `platform_settings` via `getPricing()` (cached
 *      5 min). Use this from server components to render live, edit-aware prices.
 *      The result has the same shape as the sync exports.
 *
 * Server-component rendering path:
 *   1. Server component calls `await loadTierConfig()`
 *   2. Passes the result to `SubscriptionOverview` as a `tierConfig` prop
 *   3. `SubscriptionOverview` uses props.tierConfig if provided, else falls
 *      back to the sync constants
 */

// Import the static constants from price-constants (no db imports — safe for client bundle).
import {
  STORE_PRICING,
  LISTER_PRICING,
  FINANCE_PRICING,
  AUTOMATION_PRICING,
  BUNDLE_PRICING,
  type BillingInterval,
} from '@twicely/subscriptions/price-constants';
import type { AvailableTier } from './subscription-card';

// ─── Sync helpers (use the constants from price-map) ────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}/mo`;
}

function annualSavingsPercent(monthly: number, annual: number): number {
  if (monthly === 0) return 0;
  return Math.round(((monthly - annual) / monthly) * 100);
}

// ─── Sync exports (built from fallback constants — see file header) ────────

export const STORE_TIERS: AvailableTier[] = [
  {
    tier: 'STARTER', label: 'Starter',
    monthlyPrice: formatCents(STORE_PRICING.STARTER.monthlyCents),
    annualPrice: formatCents(STORE_PRICING.STARTER.annualMonthlyCents),
    annualSavings: annualSavingsPercent(STORE_PRICING.STARTER.monthlyCents, STORE_PRICING.STARTER.annualMonthlyCents),
    features: ['250 free listings/mo', 'Announcement bar', 'Social links', 'Weekly auto-payout'],
  },
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatCents(STORE_PRICING.PRO.monthlyCents),
    annualPrice: formatCents(STORE_PRICING.PRO.annualMonthlyCents),
    annualSavings: annualSavingsPercent(STORE_PRICING.PRO.monthlyCents, STORE_PRICING.PRO.annualMonthlyCents),
    features: ['2,000 free listings/mo', 'Bulk tools', 'Coupons', 'Boosting', 'Analytics'],
  },
  {
    tier: 'POWER', label: 'Power',
    monthlyPrice: formatCents(STORE_PRICING.POWER.monthlyCents),
    annualPrice: formatCents(STORE_PRICING.POWER.annualMonthlyCents),
    annualSavings: annualSavingsPercent(STORE_PRICING.POWER.monthlyCents, STORE_PRICING.POWER.annualMonthlyCents),
    features: ['15,000 free listings/mo', 'Page builder', 'Auto-counter', 'Daily payout', '25 staff'],
  },
];

export const LISTER_TIERS: AvailableTier[] = [
  {
    tier: 'LITE', label: 'Lite',
    monthlyPrice: formatCents(LISTER_PRICING.LITE.monthlyCents),
    annualPrice: formatCents(LISTER_PRICING.LITE.annualMonthlyCents),
    annualSavings: annualSavingsPercent(LISTER_PRICING.LITE.monthlyCents, LISTER_PRICING.LITE.annualMonthlyCents),
    features: ['200 publishes/mo', '25 AI credits', '25 BG removals'],
  },
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatCents(LISTER_PRICING.PRO.monthlyCents),
    annualPrice: formatCents(LISTER_PRICING.PRO.annualMonthlyCents),
    annualSavings: annualSavingsPercent(LISTER_PRICING.PRO.monthlyCents, LISTER_PRICING.PRO.annualMonthlyCents),
    features: ['2,000 publishes/mo', '200 AI credits', '200 BG removals'],
  },
];

export const FINANCE_TIERS: AvailableTier[] = [
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatCents(FINANCE_PRICING.PRO.monthlyCents),
    annualPrice: formatCents(FINANCE_PRICING.PRO.annualMonthlyCents),
    annualSavings: annualSavingsPercent(FINANCE_PRICING.PRO.monthlyCents, FINANCE_PRICING.PRO.annualMonthlyCents),
    features: ['Full P&L', 'Cross-platform revenue', 'Expense tracking', 'Tax prep'],
  },
];

export const AUTOMATION_TIERS: AvailableTier[] = [
  {
    tier: 'DEFAULT', label: 'Automation',
    monthlyPrice: formatCents(AUTOMATION_PRICING.monthlyCents),
    annualPrice: formatCents(AUTOMATION_PRICING.annualMonthlyCents),
    annualSavings: annualSavingsPercent(AUTOMATION_PRICING.monthlyCents, AUTOMATION_PRICING.annualMonthlyCents),
    features: ['Auto-relist', 'Offer to likers', 'Smart price drops', 'Posh sharing', '2,000 actions/mo'],
  },
];

export const BUNDLES = Object.entries(BUNDLE_PRICING).map(([tier, entry]) => ({
  tier,
  name: entry.displayName,
  monthlyPrice: formatCents(entry.monthlyCents),
  annualPrice: formatCents(entry.annualMonthlyCents),
}));

export interface BundleTierConfig {
  tier: string;
  label: string;
  monthlyPrice: string;
  annualPrice: string;
  annualSavings: number;
  components: string;
  features: string[];
}

export const BUNDLE_TIERS: BundleTierConfig[] = [
  {
    tier: 'STARTER', label: 'Seller Starter',
    monthlyPrice: formatCents(BUNDLE_PRICING.STARTER.monthlyCents),
    annualPrice: formatCents(BUNDLE_PRICING.STARTER.annualMonthlyCents),
    annualSavings: annualSavingsPercent(BUNDLE_PRICING.STARTER.monthlyCents, BUNDLE_PRICING.STARTER.annualMonthlyCents),
    components: 'Store Starter + Finance Pro',
    features: ['Branded storefront', 'Full P&L + expense tracking', 'Weekly auto-payout'],
  },
  {
    tier: 'PRO', label: 'Seller Pro',
    monthlyPrice: formatCents(BUNDLE_PRICING.PRO.monthlyCents),
    annualPrice: formatCents(BUNDLE_PRICING.PRO.annualMonthlyCents),
    annualSavings: annualSavingsPercent(BUNDLE_PRICING.PRO.monthlyCents, BUNDLE_PRICING.PRO.annualMonthlyCents),
    components: 'Store Pro + Crosslister Pro + Finance Pro',
    features: ['Everything in Starter', 'Full crosslister', '2,000 publishes/mo', 'Coupons + bulk tools'],
  },
  {
    tier: 'POWER', label: 'Seller Power',
    monthlyPrice: formatCents(BUNDLE_PRICING.POWER.monthlyCents),
    annualPrice: formatCents(BUNDLE_PRICING.POWER.annualMonthlyCents),
    annualSavings: annualSavingsPercent(BUNDLE_PRICING.POWER.monthlyCents, BUNDLE_PRICING.POWER.annualMonthlyCents),
    components: 'Store Power + Crosslister Pro + Finance Pro + Automation',
    features: ['Everything in Pro', 'Page builder', 'Auto-relist + smart pricing', 'Daily payout', '25 staff seats'],
  },
];

// Re-export for convenience
export type { BillingInterval };
