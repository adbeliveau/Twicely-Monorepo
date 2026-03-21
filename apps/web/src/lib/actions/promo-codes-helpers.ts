/**
 * Shared helper for promo code actions.
 * Not a 'use server' file — imported by both affiliate and platform action files.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@twicely/db';
import { promoCode, promoCodeRedemption } from '@twicely/db/schema';
import { stripe } from '@twicely/stripe/server';
import { deactivateStripePromotionCode } from '@twicely/stripe/promo-codes';

export async function recordPromoCodeRedemption(
  promoCodeId: string,
  userId: string,
  product: string,
  discountAppliedCents: number,
  durationMonths: number,
  stripePromotionCodeId: string,
): Promise<void> {
  await db.insert(promoCodeRedemption).values({
    promoCodeId,
    userId,
    subscriptionProduct: product,
    discountAppliedCents,
    monthsRemaining: durationMonths,
    stripePromotionCodeId,
  });

  await db
    .update(promoCode)
    .set({
      usageCount: sql`${promoCode.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promoCode.id, promoCodeId));
}

/**
 * Look up a Stripe PromotionCode by code string and deactivate it.
 * Uses Stripe's code lookup — no DB schema migration needed.
 */
export async function deactivateStripeIfExists(code: string): Promise<void> {
  try {
    const list = await stripe.promotionCodes.list({ code, limit: 1 });
    const stripePromoCode = list.data[0];
    if (stripePromoCode?.active) {
      await deactivateStripePromotionCode(stripePromoCode.id);
    }
  } catch {
    // Stripe sync failure does not block the operation
  }
}
