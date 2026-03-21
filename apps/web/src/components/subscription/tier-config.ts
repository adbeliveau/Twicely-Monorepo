/**
 * D3-S3: Static tier configuration for subscription UI.
 *
 * Built from price-map functions at module load — never hardcoded prices.
 */

import {
  formatTierPrice,
  getAnnualSavingsPercent,
  BUNDLE_PRICING,
} from '@twicely/subscriptions/price-map';
import type { AvailableTier } from './subscription-card';

export const STORE_TIERS: AvailableTier[] = [
  {
    tier: 'STARTER', label: 'Starter',
    monthlyPrice: formatTierPrice('store', 'STARTER', 'monthly'),
    annualPrice: formatTierPrice('store', 'STARTER', 'annual'),
    annualSavings: getAnnualSavingsPercent('store', 'STARTER'),
    features: ['250 free listings/mo', 'Announcement bar', 'Social links', 'Weekly auto-payout'],
  },
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatTierPrice('store', 'PRO', 'monthly'),
    annualPrice: formatTierPrice('store', 'PRO', 'annual'),
    annualSavings: getAnnualSavingsPercent('store', 'PRO'),
    features: ['2,000 free listings/mo', 'Bulk tools', 'Coupons', 'Boosting', 'Analytics'],
  },
  {
    tier: 'POWER', label: 'Power',
    monthlyPrice: formatTierPrice('store', 'POWER', 'monthly'),
    annualPrice: formatTierPrice('store', 'POWER', 'annual'),
    annualSavings: getAnnualSavingsPercent('store', 'POWER'),
    features: ['15,000 free listings/mo', 'Page builder', 'Auto-counter', 'Daily payout', '25 staff'],
  },
];

export const LISTER_TIERS: AvailableTier[] = [
  {
    tier: 'LITE', label: 'Lite',
    monthlyPrice: formatTierPrice('lister', 'LITE', 'monthly'),
    annualPrice: formatTierPrice('lister', 'LITE', 'annual'),
    annualSavings: getAnnualSavingsPercent('lister', 'LITE'),
    features: ['200 publishes/mo', '25 AI credits', '25 BG removals'],
  },
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatTierPrice('lister', 'PRO', 'monthly'),
    annualPrice: formatTierPrice('lister', 'PRO', 'annual'),
    annualSavings: getAnnualSavingsPercent('lister', 'PRO'),
    features: ['2,000 publishes/mo', '200 AI credits', '200 BG removals'],
  },
];

export const FINANCE_TIERS: AvailableTier[] = [
  {
    tier: 'PRO', label: 'Pro',
    monthlyPrice: formatTierPrice('finance', 'PRO', 'monthly'),
    annualPrice: formatTierPrice('finance', 'PRO', 'annual'),
    annualSavings: getAnnualSavingsPercent('finance', 'PRO'),
    features: ['Full P&L', 'Cross-platform revenue', 'Expense tracking', 'Tax prep'],
  },
];

export const AUTOMATION_TIERS: AvailableTier[] = [
  {
    tier: 'DEFAULT', label: 'Automation',
    monthlyPrice: formatTierPrice('automation', 'DEFAULT', 'monthly'),
    annualPrice: formatTierPrice('automation', 'DEFAULT', 'annual'),
    annualSavings: getAnnualSavingsPercent('automation', 'DEFAULT'),
    features: ['Auto-relist', 'Offer to likers', 'Smart price drops', 'Posh sharing', '2,000 actions/mo'],
  },
];

export const BUNDLES = Object.entries(BUNDLE_PRICING).map(([tier, entry]) => ({
  tier,
  name: entry.displayName,
  monthlyPrice: formatTierPrice('bundle', tier, 'monthly'),
  annualPrice: formatTierPrice('bundle', tier, 'annual'),
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
    monthlyPrice: formatTierPrice('bundle', 'STARTER', 'monthly'),
    annualPrice: formatTierPrice('bundle', 'STARTER', 'annual'),
    annualSavings: getAnnualSavingsPercent('bundle', 'STARTER'),
    components: 'Store Starter + Finance Pro',
    features: ['Branded storefront', 'Full P&L + expense tracking', 'Weekly auto-payout'],
  },
  {
    tier: 'PRO', label: 'Seller Pro',
    monthlyPrice: formatTierPrice('bundle', 'PRO', 'monthly'),
    annualPrice: formatTierPrice('bundle', 'PRO', 'annual'),
    annualSavings: getAnnualSavingsPercent('bundle', 'PRO'),
    components: 'Store Pro + Crosslister Pro + Finance Pro',
    features: ['Everything in Starter', 'Full crosslister', '2,000 publishes/mo', 'Coupons + bulk tools'],
  },
  {
    tier: 'POWER', label: 'Seller Power',
    monthlyPrice: formatTierPrice('bundle', 'POWER', 'monthly'),
    annualPrice: formatTierPrice('bundle', 'POWER', 'annual'),
    annualSavings: getAnnualSavingsPercent('bundle', 'POWER'),
    components: 'Store Power + Crosslister Pro + Finance Pro + Automation',
    features: ['Everything in Pro', 'Page builder', 'Auto-relist + smart pricing', 'Daily payout', '25 staff seats'],
  },
];
