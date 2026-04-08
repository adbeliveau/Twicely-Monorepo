'use server';

/**
 * Server actions wrapping price-map.ts for client components.
 *
 * The price-map functions read from `platform_settings` (postgres) and cannot
 * run in the browser. Client components like `change-plan-dialog.tsx` need to
 * call these via server actions instead of importing price-map directly —
 * importing price-map from a client file pulls the postgres driver into the
 * browser bundle and breaks the build.
 */

import {
  getPricing,
  formatTierPrice,
  getAnnualSavingsPercent,
} from '@twicely/subscriptions/price-map';
import type { BillingInterval, SubscriptionProduct } from '@twicely/subscriptions/price-map';
import { getChangePreview } from '@twicely/subscriptions/subscription-engine';
import type { ChangePreview } from '@twicely/subscriptions/subscription-engine';

export async function getTierPriceDisplayAction(
  product: SubscriptionProduct,
  tier: string,
  interval: BillingInterval,
): Promise<{ price: string; savings: number }> {
  const [price, savings] = await Promise.all([
    formatTierPrice(product, tier, interval),
    interval === 'annual' ? getAnnualSavingsPercent(product, tier) : Promise.resolve(0),
  ]);
  return { price, savings };
}

/** Note: getChangePreview only accepts subscription products with tier hierarchies
 * (store / lister / finance / bundle). Automation has no tier ladder so it can't be
 * "previewed" — pass a different product. */
export async function getChangePreviewAction(input: {
  product: 'store' | 'lister' | 'finance' | 'bundle';
  currentTier: string;
  currentInterval: BillingInterval;
  targetTier: string;
  targetInterval: BillingInterval;
  currentPeriodEnd: Date;
}): Promise<ChangePreview> {
  return getChangePreview(input);
}

export async function getPricingAction(
  product: SubscriptionProduct,
  tier: string,
): Promise<Awaited<ReturnType<typeof getPricing>>> {
  return getPricing(product, tier);
}
