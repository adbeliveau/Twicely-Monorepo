'use server';

import { db } from '@twicely/db';
import { order, orderItem, listing, ledgerEntry, orderPayment, cart, promotionUsage, promotion, platformSetting } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { stripe } from '@twicely/stripe/server';
import { declineAllPendingOffersForListing } from '@twicely/commerce/offer-transitions';
import { updateEngagement } from '@/lib/actions/browsing-history-helpers';
import { getAuthOfferConfig } from '@twicely/commerce/auth-offer';
import { finalizeOrderSchema, finalizeOrdersSchema } from '@/lib/validations/checkout-finalize';
import { logger } from '@twicely/logger';

interface FinalizeOrderResult {
  success: boolean;
  error?: string;
}

/**
 * Finalize order after payment: verify payment, update status, decrement inventory, create ledger entries.
 *
 * With destination charges:
 * - Stripe automatically transfers (totalCents - applicationFee) to seller
 * - We record ledger entries for tracking
 * - The actual Stripe fees come from the balance.transaction webhook (but we estimate here)
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

  // Get order for this paymentIntent (with destination charges, 1 PI = 1 order)
  const orders = await db
    .select({
      id: order.id,
      status: order.status,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      totalCents: order.totalCents,
      discountCents: order.discountCents,
      sourceCartId: order.sourceCartId,
      authenticationOffered: order.authenticationOffered,
      authenticationDeclined: order.authenticationDeclined,
    })
    .from(order)
    .where(eq(order.paymentIntentId, paymentIntentId));

  if (orders.length === 0) {
    return { success: false, error: 'Order not found' };
  }

  // With destination charges, each PI is for one order
  const ord = orders[0]!;

  // Verify buyer owns this order
  if (ord.buyerId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Idempotency: if already PAID, return success
  if (ord.status === 'PAID') {
    return { success: true };
  }

  // Verify payment with Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded') {
    return { success: false, error: 'Payment not completed' };
  }

  const now = new Date();

  // Get actual application fee from PaymentIntent (this is the TF we charged)
  const applicationFeeAmount = paymentIntent.application_fee_amount ?? 0;

  // Read Stripe processing fee rates from platform_settings (never hardcode)
  const [rateSetting] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'commerce.stripe.processingRateBps'))
    .limit(1);
  const [fixedSetting] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, 'commerce.stripe.processingFixedCents'))
    .limit(1);
  const stripeRateBps = Number(rateSetting?.value) || 290; // 2.9% default
  const stripeFixedCents = Number(fixedSetting?.value) || 30; // $0.30 default

  const purchasedListingIds = await db.transaction(async (tx) => {
    // Update order status to PAID
    await tx
      .update(order)
      .set({
        status: 'PAID',
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(order.id, ord.id));

    // Get order items
    const items = await tx
      .select({
        id: orderItem.id,
        listingId: orderItem.listingId,
        quantity: orderItem.quantity,
        unitPriceCents: orderItem.unitPriceCents,
        tfAmountCents: orderItem.tfAmountCents,
      })
      .from(orderItem)
      .where(eq(orderItem.orderId, ord.id));

    // Decrement inventory and update listing status
    for (const item of items) {
      const [updatedListing] = await tx
        .update(listing)
        .set({
          availableQuantity: sql`GREATEST(0, COALESCE(${listing.availableQuantity}, ${listing.quantity}) - ${item.quantity})`,
          soldQuantity: sql`${listing.soldQuantity} + ${item.quantity}`,
          updatedAt: now,
        })
        .where(eq(listing.id, item.listingId))
        .returning({ availableQuantity: listing.availableQuantity });

      // Mark as SOLD if no inventory left
      if (updatedListing && (updatedListing.availableQuantity ?? 0) <= 0) {
        await tx
          .update(listing)
          .set({ status: 'SOLD', soldAt: now, updatedAt: now })
          .where(eq(listing.id, item.listingId));

        // Decline all pending offers for this listing (release holds)
        // Fire-and-forget outside transaction to avoid deadlock
        declineAllPendingOffersForListing(item.listingId).catch((err) => {
          logger.error('[checkout] Failed to decline offers for listing', { listingId: item.listingId, error: String(err) });
        });
      }
    }

    // With destination charges, Stripe auto-transfers to seller minus application_fee.
    // Stripe processing fee (~2.9% + $0.30) is deducted from platform (Twicely), not seller.
    // The seller receives: totalCents - applicationFeeAmount (transferred directly)
    // Twicely receives: applicationFeeAmount (minus Stripe's cut from platform balance)

    const stripeFeeEstimateCents = Math.round(ord.totalCents * stripeRateBps / 10000 + stripeFixedCents);
    const netToSellerCents = ord.totalCents - applicationFeeAmount;

    // Create ledger entries for tracking
    // 1. Payment captured (what seller receives via transfer)
    await tx.insert(ledgerEntry).values({
      type: 'ORDER_PAYMENT_CAPTURED',
      status: 'POSTED',
      amountCents: netToSellerCents,
      userId: ord.sellerId,
      orderId: ord.id,
      stripePaymentIntentId: paymentIntentId,
      postedAt: now,
    });

    // 2. TF fee (for tracking; already collected as application_fee_amount)
    await tx.insert(ledgerEntry).values({
      type: 'ORDER_TF_FEE',
      status: 'POSTED',
      amountCents: applicationFeeAmount, // Positive: this is platform revenue
      userId: ord.sellerId,
      orderId: ord.id,
      stripePaymentIntentId: paymentIntentId,
      postedAt: now,
    });

    // 3. Authentication fee (B3.5) - if buyer opted in (not declined)
    if (ord.authenticationOffered && !ord.authenticationDeclined) {
      await tx.insert(ledgerEntry).values({
        type: 'AUTH_FEE_BUYER',
        status: 'POSTED',
        amountCents: (await getAuthOfferConfig()).buyerFeeCents,
        userId: ord.buyerId, // Charged to buyer, not seller
        orderId: ord.id,
        stripePaymentIntentId: paymentIntentId,
        postedAt: now,
      });
    }

    // Create orderPayment record
    await tx.insert(orderPayment).values({
      orderId: ord.id,
      stripePaymentIntentId: paymentIntentId,
      status: 'captured',
      amountCents: ord.totalCents,
      stripeFeesCents: stripeFeeEstimateCents,
      tfAmountCents: applicationFeeAmount, // TF (Transaction Fee)
      netToSellerCents,
      capturedAt: now,
    });

    // Record promotion usage if a coupon was applied (D2.3)
    // Get promotionId from PaymentIntent metadata
    const promotionId = paymentIntent.metadata?.promotionId;
    const discountCentsFromMeta = parseInt(paymentIntent.metadata?.discountCents ?? '0', 10);

    if (promotionId && discountCentsFromMeta > 0) {
      // Record promotionUsage
      await tx.insert(promotionUsage).values({
        promotionId,
        orderId: ord.id,
        buyerId: ord.buyerId,
        discountCents: discountCentsFromMeta,
      });

      // Increment promotion.usageCount
      await tx
        .update(promotion)
        .set({
          usageCount: sql`${promotion.usageCount} + 1`,
          updatedAt: now,
        })
        .where(eq(promotion.id, promotionId));
    }

    // Return listing IDs for engagement tracking
    return items.map((item) => item.listingId);
  });

  // Track purchase engagement (fire-and-forget)
  for (const listingId of purchasedListingIds) {
    updateEngagement(userId, listingId, 'purchase').catch(() => {});
  }

  // Convert cart to CONVERTED now that payment is confirmed
  if (ord.sourceCartId) {
    await db
      .update(cart)
      .set({ status: 'CONVERTED', updatedAt: new Date() })
      .where(eq(cart.id, ord.sourceCartId));
  }

  return { success: true };
}

/**
 * Finalize multiple orders (for multi-seller checkout).
 * Calls finalizeOrder for each paymentIntentId.
 */
export async function finalizeOrders(paymentIntentIds: string[]): Promise<FinalizeOrderResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('create', 'Order')) {
    return { success: false, error: 'Not authorized to create orders' };
  }

  const parsed = finalizeOrdersSchema.safeParse({ paymentIntentIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  for (const piId of paymentIntentIds) {
    const result = await finalizeOrder(piId);
    if (!result.success) {
      return result;
    }
  }
  return { success: true };
}
