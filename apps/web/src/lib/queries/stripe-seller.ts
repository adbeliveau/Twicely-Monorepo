/**
 * Stripe Seller Queries
 *
 * Database queries for seller Stripe-related data.
 */

import { db } from '@twicely/db';
import { sellerProfile, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export interface SellerStripeStatus {
  userId: string;
  email: string;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  payoutsEnabled: boolean;
  storeTier: string;
}

/**
 * Get seller's Stripe status by user ID.
 */
export async function getSellerStripeStatus(userId: string): Promise<SellerStripeStatus | null> {
  const [result] = await db
    .select({
      userId: sellerProfile.userId,
      email: user.email,
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
      payoutsEnabled: sellerProfile.payoutsEnabled,
      storeTier: sellerProfile.storeTier,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(user.id, sellerProfile.userId))
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!result) return null;

  return {
    userId: result.userId,
    email: result.email!,
    stripeAccountId: result.stripeAccountId,
    stripeOnboarded: result.stripeOnboarded,
    payoutsEnabled: result.payoutsEnabled,
    storeTier: result.storeTier,
  };
}

/**
 * Get seller's Stripe account ID by seller profile ID.
 */
export async function getSellerStripeAccountId(sellerId: string): Promise<string | null> {
  // sellerId could be userId or sellerProfile.id — we handle both
  const [result] = await db
    .select({ stripeAccountId: sellerProfile.stripeAccountId })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  return result?.stripeAccountId ?? null;
}

/**
 * Check if a seller is ready to receive payments.
 */
export async function isSellerPaymentReady(sellerId: string): Promise<boolean> {
  const [result] = await db
    .select({
      stripeOnboarded: sellerProfile.stripeOnboarded,
      payoutsEnabled: sellerProfile.payoutsEnabled,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!result) return false;

  return result.stripeOnboarded && result.payoutsEnabled;
}

/**
 * Get seller's store tier (needed for TF calculation and payout schedule).
 */
export async function getSellerStoreTier(sellerId: string): Promise<string | null> {
  const [result] = await db
    .select({ storeTier: sellerProfile.storeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  return result?.storeTier ?? null;
}
