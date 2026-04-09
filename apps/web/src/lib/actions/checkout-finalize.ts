'use server';

import { db } from '@twicely/db';
import { order, orderItem, listing, ledgerEntry, orderPayment, cart, promotionUsage, promotion, platformSetting } from '@twicely/db/schema';
import { eq, and, ne, sql, inArray } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { stripe } from '@twicely/stripe/server';
import { declineAllPendingOffersForListing } from '@twicely/commerce/offer-transitions';
import { updateEngagement } from '@/lib/actions/browsing-history-helpers';
import { getAuthOfferConfig } from '@twicely/commerce/auth-offer';
import { finalizeOrderSchema } from '@/lib/validations/checkout-finalize';
import { revalidatePath } from 'next/cache';
import { logger } from '@twicely/logger';

interface FinalizeOrderResult {
  success: boolean;
  error?: string;
}

/**
 * Finalize order after payment: verify payment, update status, decrement inventory, create ledger entries.
 *
 * Coupon handling:
 * - If a coupon was applied, record promotionUsage and increment promotion.usageCount
 * - Coupon metadata (promotionId, discountCents) stored on PaymentIntent metadata
 */
export async function finalizeOrder(paymentIntentId: string): Promise<FinalizeOrderResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('create', 'Order')) {
    return { success: false, error: 'Your account cannot place orders' };
  }

  const parsed = finalizeOrderSchema.safeParse({ paymentIntentId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = session.userId;

  const orders = await db
    .select({
      id: order.id, status: order.status, buyerId: order.buyerId,
      sellerId: order.sellerId, totalCents: order.totalCents,
      discountCents: order.discountCents, sourceCartId: order.sourceCartId,
      authenticationOffered: order.authenticationOffered,
      authenticationDeclined: order.authenticationDeclined,
    })
    .from(order)
    .where(eq(order.paymentIntentId, paymentIntentId));

  if (orders.length === 0) return { success: false, error: 'Order not found' };
  const ord = orders[0]!;
  if (ord.buyerId !== userId) return { success: false, error: 'Unauthorized' };
  if (ord.status === 'PAID') return { success: true };

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded') return { success: false, error: 'Payment not completed' };

  const now = new Date();
  const applicationFeeAmount = paymentIntent.application_fee_amount ?? 0;

  const [rateSetting] = await db.select({ value: platformSetting.value }).from(platformSetting).where(eq(platformSetting.key, 'commerce.stripe.processingRateBps')).limit(1);
  const [fixedSetting] = await db.select({ value: platformSetting.value }).from(platformSetting).where(eq(platformSetting.key, 'commerce.stripe.processingFixedCents')).limit(1);
  const stripeRateBps = Number.isNaN(Number(rateSetting?.value)) ? 290 : Number(rateSetting?.value);
  const stripeFixedCents = Number.isNaN(Number(fixedSetting?.value)) ? 30 : Number(fixedSetting?.value);
  const stripeFeeEstimateCents = Math.round(ord.totalCents * stripeRateBps / 10000 + stripeFixedCents);
  const netToSellerCents = ord.totalCents - applicationFeeAmount;

  const purchasedListingIds = await db.transaction(async (tx) => {
    const [updatedOrder] = await tx
      .update(order).set({ status: 'PAID', paidAt: now, updatedAt: now })
      .where(and(eq(order.id, ord.id), ne(order.status, 'PAID'))).returning({ id: order.id });
    if (!updatedOrder) return [];

    const items = await tx.select({
      id: orderItem.id, listingId: orderItem.listingId,
      quantity: orderItem.quantity, unitPriceCents: orderItem.unitPriceCents,
      tfAmountCents: orderItem.tfAmountCents,
    }).from(orderItem).where(eq(orderItem.orderId, ord.id));

    const listingIds = items.map((it) => it.listingId);
    if (listingIds.length > 0) {
      await tx.select({ id: listing.id }).from(listing).where(inArray(listing.id, listingIds)).for('update');
    }

    for (const item of items) {
      const [upd] = await tx.update(listing).set({
        availableQuantity: sql`GREATEST(0, COALESCE(${listing.availableQuantity}, ${listing.quantity}) - ${item.quantity})`,
        soldQuantity: sql`${listing.soldQuantity} + ${item.quantity}`, updatedAt: now,
      }).where(eq(listing.id, item.listingId)).returning({ availableQuantity: listing.availableQuantity });
      if (upd && (upd.availableQuantity ?? 0) <= 0) {
        await tx.update(listing).set({ status: 'SOLD', soldAt: now, updatedAt: now }).where(eq(listing.id, item.listingId));
        declineAllPendingOffersForListing(item.listingId).catch((err) => {
          logger.error('[checkout] Failed to decline offers for listing', { listingId: item.listingId, error: String(err) });
        });
      }
    }

    // Ledger entries (destination charges pattern)
    await tx.insert(ledgerEntry).values({ type: 'ORDER_PAYMENT_CAPTURED', status: 'POSTED', amountCents: netToSellerCents, userId: ord.sellerId, orderId: ord.id, stripePaymentIntentId: paymentIntentId, idempotencyKey: `order:${ord.id}:capture`, postedAt: now });
    await tx.insert(ledgerEntry).values({ type: 'ORDER_TF_FEE', status: 'POSTED', amountCents: applicationFeeAmount, userId: ord.sellerId, orderId: ord.id, stripePaymentIntentId: paymentIntentId, idempotencyKey: `order:${ord.id}:tf`, postedAt: now });
    if (ord.authenticationOffered && !ord.authenticationDeclined) {
      await tx.insert(ledgerEntry).values({ type: 'AUTH_FEE_BUYER', status: 'POSTED', amountCents: (await getAuthOfferConfig()).buyerFeeCents, userId: ord.buyerId, orderId: ord.id, stripePaymentIntentId: paymentIntentId, idempotencyKey: `order:${ord.id}:auth_fee_buyer`, postedAt: now });
    }
    await tx.insert(orderPayment).values({ orderId: ord.id, stripePaymentIntentId: paymentIntentId, status: 'captured', amountCents: ord.totalCents, stripeFeesCents: stripeFeeEstimateCents, tfAmountCents: applicationFeeAmount, netToSellerCents, capturedAt: now });

    // Record promotion usage (D2.3) — SEC-002: atomic check-and-increment
    const promotionId = paymentIntent.metadata?.promotionId;
    const discountCentsFromMeta = parseInt(paymentIntent.metadata?.discountCents ?? '0', 10);
    if (promotionId && discountCentsFromMeta > 0) {
      const [promoRow] = await tx.select({ id: promotion.id, isActive: promotion.isActive }).from(promotion).where(eq(promotion.id, promotionId));
      if (!promoRow || !promoRow.isActive) {
        logger.warn('[finalizeOrder] Promotion not found or inactive', { promotionId, paymentIntentId });
      } else {
        const [updated] = await tx.update(promotion).set({ usageCount: sql`${promotion.usageCount} + 1`, updatedAt: now })
          .where(and(eq(promotion.id, promotionId), sql`(${promotion.maxUsesTotal} IS NULL OR ${promotion.maxUsesTotal} = 0 OR ${promotion.usageCount} < ${promotion.maxUsesTotal})`))
          .returning({ id: promotion.id });
        if (!updated) throw new Error('Coupon usage limit reached — discount could not be applied');
        await tx.insert(promotionUsage).values({ promotionId, orderId: ord.id, buyerId: ord.buyerId, discountCents: discountCentsFromMeta });
      }
    }

    return items.map((item) => item.listingId);
  });

  for (const listingId of purchasedListingIds) {
    updateEngagement(userId, listingId, 'purchase').catch(() => {});
  }

  if (ord.sourceCartId) {
    await db.update(cart).set({ status: 'CONVERTED', updatedAt: new Date() }).where(eq(cart.id, ord.sourceCartId));
  }

  revalidatePath('/my/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}
