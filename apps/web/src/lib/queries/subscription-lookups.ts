/**
 * D3-S2: Subscription Lookup Queries
 *
 * Queries needed by the webhook handler that were NOT in D3-S1.
 * These are read-only lookups for identifying sellers and subscriptions.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  storeSubscription,
  listerSubscription,
  automationSubscription,
  financeSubscription,
  bundleSubscription,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type { StoreTier, ListerTier, FinanceTier } from '@/types/enums';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SellerByStripeCustomer {
  sellerProfileId: string;
  userId: string;
  storeTier: StoreTier;
  listerTier: ListerTier;
  hasAutomation: boolean;
  financeTier: FinanceTier;
}

export interface SubscriptionLookupResult {
  product: 'store' | 'lister' | 'automation' | 'finance' | 'bundle';
  subscriptionId: string;
  sellerProfileId: string;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Find seller profile by Stripe Customer ID.
 * Used by webhook handler to identify which seller a subscription event belongs to.
 */
export async function findSellerByStripeCustomerId(
  customerId: string
): Promise<SellerByStripeCustomer | null> {
  const [row] = await db
    .select({
      sellerProfileId: sellerProfile.id,
      userId: sellerProfile.userId,
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      hasAutomation: sellerProfile.hasAutomation,
      financeTier: sellerProfile.financeTier,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.stripeCustomerId, customerId))
    .limit(1);
  return row ?? null;
}

/**
 * Find which subscription table contains a given Stripe subscription ID.
 * Searches all 4 tables sequentially (expect early match).
 * Returns the product type, internal subscription ID, and seller profile ID.
 */
export async function findSubscriptionByStripeId(
  stripeSubId: string
): Promise<SubscriptionLookupResult | null> {
  // Check storeSubscription first (most common)
  const [storeRow] = await db
    .select({
      subscriptionId: storeSubscription.id,
      sellerProfileId: storeSubscription.sellerProfileId,
    })
    .from(storeSubscription)
    .where(eq(storeSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (storeRow) {
    return { product: 'store', ...storeRow };
  }

  // Check listerSubscription
  const [listerRow] = await db
    .select({
      subscriptionId: listerSubscription.id,
      sellerProfileId: listerSubscription.sellerProfileId,
    })
    .from(listerSubscription)
    .where(eq(listerSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (listerRow) {
    return { product: 'lister', ...listerRow };
  }

  // Check automationSubscription
  const [autoRow] = await db
    .select({
      subscriptionId: automationSubscription.id,
      sellerProfileId: automationSubscription.sellerProfileId,
    })
    .from(automationSubscription)
    .where(eq(automationSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (autoRow) {
    return { product: 'automation', ...autoRow };
  }

  // Check financeSubscription
  const [financeRow] = await db
    .select({
      subscriptionId: financeSubscription.id,
      sellerProfileId: financeSubscription.sellerProfileId,
    })
    .from(financeSubscription)
    .where(eq(financeSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (financeRow) {
    return { product: 'finance', ...financeRow };
  }

  // Check bundleSubscription
  const [bundleRow] = await db
    .select({
      subscriptionId: bundleSubscription.id,
      sellerProfileId: bundleSubscription.sellerProfileId,
    })
    .from(bundleSubscription)
    .where(eq(bundleSubscription.stripeSubscriptionId, stripeSubId))
    .limit(1);
  if (bundleRow) {
    return { product: 'bundle', ...bundleRow };
  }

  return null;
}
