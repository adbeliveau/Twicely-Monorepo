'use server';

import { db } from '@twicely/db';
import { order, orderItem, sellerProfile, promotion } from '@twicely/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { createOrdersFromCart } from '@twicely/commerce/create-order';
import { createConnectPaymentIntent } from '@twicely/stripe/server';
import type { ShippingAddressJson } from '@/lib/validations/address';
import { initiateCheckoutSchema } from '@/lib/validations/checkout';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getValkeyClient } from '@twicely/db/cache';
import { logger } from '@twicely/logger';

// Re-export finalize functions from split file
export { finalizeOrder, finalizeOrders } from './checkout-finalize';

interface CouponData {
  promotionId: string;
  couponCode: string;
  discountCents: number;
  freeShipping: boolean;
  appliedToSellerId: string;
}

interface InitiateCheckoutInput {
  cartId: string;
  shippingAddress: ShippingAddressJson;
  buyerNote?: string;
  /** If true, this is a local pickup order (no shipping, standard progressive TF brackets) */
  isLocalPickup?: boolean;
  /** If true, buyer opted into authentication ($19.99 fee added to total) */
  authenticationRequested?: boolean;
  /** Applied coupon discount */
  coupon?: CouponData;
}

interface OrderPaymentInfo {
  orderId: string;
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
}

interface InitiateCheckoutResult {
  success: boolean;
  /** For single-seller checkout, returns clientSecret directly */
  clientSecret?: string;
  /** For multi-seller checkout, returns array of payment info per order */
  orderPayments?: OrderPaymentInfo[];
  orderIds?: string[];
  totalCents?: number;
  error?: string;
}

/**
 * Initiate checkout: create orders, create PaymentIntent(s) with destination charges.
 *
 * Uses Stripe Connect destination charges pattern:
 * - One PaymentIntent per seller/order
 * - application_fee_amount = TF (Transaction Fee, Twicely's take)
 * - transfer_data.destination = seller's connected account
 *
 * For single-seller carts, returns a single clientSecret.
 * For multi-seller carts, returns orderPayments array.
 *
 * Coupon handling:
 * - Coupon applies only to the seller it belongs to (input.coupon.appliedToSellerId)
 * - Discount subtracted from that seller's order total before PaymentIntent
 * - TF is recalculated on the discounted total
 */
export async function initiateCheckout(input: InitiateCheckoutInput): Promise<InitiateCheckoutResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to checkout' };
  }

  if (!ability.can('create', 'Order')) {
    return { success: false, error: 'Your account cannot place orders' };
  }

  // SECURITY: Rate limit checkout to prevent abuse/DoS (5 per 10 min per user)
  try {
    const valkey = getValkeyClient();
    const rateLimitKey = `checkout-rate:${session.userId}`;
    const attempts = await valkey.incr(rateLimitKey);
    if (attempts === 1) await valkey.expire(rateLimitKey, 600);
    if (attempts > 5) {
      logger.warn('[checkout] Rate limited', { userId: session.userId, attempts });
      return { success: false, error: 'Too many checkout attempts. Please wait a few minutes.' };
    }
  } catch (err) {
    // Valkey unavailable — fail open (rate limiting best-effort only)
    logger.warn('[checkout] Valkey rate-limit check failed, proceeding', { userId: session.userId, error: String(err) });
  }

  const parsed = initiateCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = session.userId;

  // Create orders from cart (one per seller)
  const orderResults = await createOrdersFromCart({
    userId,
    cartId: input.cartId,
    shippingAddress: input.shippingAddress,
    buyerNote: input.buyerNote,
    isLocalPickup: input.isLocalPickup,
    authenticationRequested: input.authenticationRequested,
  });

  const failedOrders = orderResults.filter((r) => !r.success);
  if (failedOrders.length > 0) {
    return { success: false, error: failedOrders[0]?.error ?? 'Failed to create orders' };
  }

  const orderIds = orderResults.map((r) => r.orderId!);

  // Get created orders with seller info
  const createdOrders = await db
    .select({
      id: order.id,
      sellerId: order.sellerId,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(inArray(order.id, orderIds));

  // Get seller Stripe account IDs
  const sellerIds = [...new Set(createdOrders.map((o) => o.sellerId))];
  const sellers = await db
    .select({
      userId: sellerProfile.userId,
      stripeAccountId: sellerProfile.stripeAccountId,
      payoutsEnabled: sellerProfile.payoutsEnabled,
    })
    .from(sellerProfile)
    .where(inArray(sellerProfile.userId, sellerIds));

  const sellerMap = new Map(sellers.map((s) => [s.userId, s]));

  // Verify all sellers have completed Stripe onboarding
  for (const sellerId of sellerIds) {
    const seller = sellerMap.get(sellerId);
    if (!seller?.stripeAccountId || !seller.payoutsEnabled) {
      return {
        success: false,
        error: 'One or more sellers have not completed payment setup',
      };
    }
  }

  // Get TF (Transaction Fee) for each order
  const orderTfMap = new Map<string, number>();
  for (const ordId of orderIds) {
    const items = await db
      .select({ tfAmountCents: orderItem.tfAmountCents })
      .from(orderItem)
      .where(eq(orderItem.orderId, ordId));

    const totalTf = items.reduce((sum, i) => sum + (i.tfAmountCents ?? 0), 0);
    orderTfMap.set(ordId, totalTf);
  }

  // SECURITY: Re-validate coupon server-side — never trust discountCents from client
  let verifiedDiscountCents = 0;
  if (input.coupon) {
    const now = new Date();
    const [promo] = await db
      .select({
        id: promotion.id,
        isActive: promotion.isActive,
        discountPercent: promotion.discountPercent,
        discountAmountCents: promotion.discountAmountCents,
        minimumOrderCents: promotion.minimumOrderCents,
        maxUsesTotal: promotion.maxUsesTotal,
        maxUsesPerBuyer: promotion.maxUsesPerBuyer,
        usageCount: promotion.usageCount,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        couponCode: promotion.couponCode,
      })
      .from(promotion)
      .where(eq(promotion.id, input.coupon.promotionId))
      .limit(1);

    if (!promo || !promo.isActive || promo.startsAt > now || (promo.endsAt && promo.endsAt < now)) {
      return { success: false, error: 'Coupon is no longer valid' };
    }
    if (promo.couponCode !== input.coupon.couponCode) {
      return { success: false, error: 'Invalid coupon code' };
    }
    if (promo.maxUsesTotal && promo.usageCount >= promo.maxUsesTotal) {
      return { success: false, error: 'Coupon usage limit reached' };
    }

    // Recompute discount server-side from promotion data
    const applicableOrder = createdOrders.find((o) => o.sellerId === input.coupon!.appliedToSellerId);
    if (applicableOrder) {
      if (promo.discountAmountCents) {
        verifiedDiscountCents = Math.min(promo.discountAmountCents, applicableOrder.totalCents);
      } else if (promo.discountPercent) {
        verifiedDiscountCents = Math.round(applicableOrder.totalCents * promo.discountPercent / 100);
      }
      if (promo.minimumOrderCents && applicableOrder.totalCents < promo.minimumOrderCents) {
        verifiedDiscountCents = 0; // Order below minimum — coupon does not apply
      }
    }
    // Override client-supplied discountCents with server-computed value
    input.coupon.discountCents = verifiedDiscountCents;
  }

  // Pre-flight: calculate adjusted totals (accounting for coupon) and check minimum
  const MIN_ORDER_CENTS = await getPlatformSetting<number>('commerce.order.minimumCents', 100);
  let preflightTotalCents = 0;
  for (const ord of createdOrders) {
    let discountForOrder = 0;
    if (input.coupon && input.coupon.appliedToSellerId === ord.sellerId) {
      discountForOrder = verifiedDiscountCents;
    }
    preflightTotalCents += Math.max(0, ord.totalCents - discountForOrder);
  }
  if (preflightTotalCents < MIN_ORDER_CENTS) {
    return { success: false, error: 'Order total must be at least $1.00' };
  }

  // Create PaymentIntent per order (destination charges)
  const orderPayments: OrderPaymentInfo[] = [];

  for (const ord of createdOrders) {
    const seller = sellerMap.get(ord.sellerId)!;
    const baseTfCents = orderTfMap.get(ord.id) ?? 0;

    // Apply coupon discount if this is the seller the coupon applies to
    let discountCents = 0;
    if (input.coupon && input.coupon.appliedToSellerId === ord.sellerId) {
      discountCents = input.coupon.discountCents;
    }

    // Calculate adjusted total after discount
    const adjustedTotalCents = Math.max(0, ord.totalCents - discountCents);

    // Recalculate TF on discounted total (proportional reduction)
    // TF should be based on what buyer actually pays
    let adjustedTfCents = baseTfCents;
    if (discountCents > 0 && ord.totalCents > 0) {
      // Scale TF proportionally to the discount
      const discountRatio = adjustedTotalCents / ord.totalCents;
      adjustedTfCents = Math.round(baseTfCents * discountRatio);
    }

    // Update order with discount amount
    if (discountCents > 0) {
      await db
        .update(order)
        .set({
          discountCents,
          totalCents: adjustedTotalCents,
          updatedAt: new Date(),
        })
        .where(eq(order.id, ord.id));
    }

    let clientSecret: string;
    let paymentIntentId: string;
    try {
      const piResult = await createConnectPaymentIntent({
        amountCents: adjustedTotalCents,
        applicationFeeCents: adjustedTfCents,
        destinationAccountId: seller.stripeAccountId!,
        metadata: {
          orderId: ord.id,
          buyerId: userId,
          sellerId: ord.sellerId,
          ...(discountCents > 0 && input.coupon ? {
            promotionId: input.coupon.promotionId,
            couponCode: input.coupon.couponCode,
            discountCents: String(discountCents),
          } : {}),
        },
      });
      clientSecret = piResult.clientSecret;
      paymentIntentId = piResult.paymentIntentId;
    } catch (err) {
      logger.error('[checkout] Failed to create PaymentIntent', { orderId: ord.id, error: String(err) });
      return { success: false, error: 'Failed to create payment. Please try again.' };
    }

    // Update order with paymentIntentId
    await db
      .update(order)
      .set({ paymentIntentId, updatedAt: new Date() })
      .where(eq(order.id, ord.id));

    orderPayments.push({
      orderId: ord.id,
      clientSecret,
      paymentIntentId,
      amountCents: adjustedTotalCents,
    });
  }

  // Calculate final total (sum of adjusted amounts)
  const totalCents = orderPayments.reduce((sum, op) => sum + op.amountCents, 0);

  // For single-seller checkout, return clientSecret directly for simpler UI
  if (orderPayments.length === 1) {
    return {
      success: true,
      clientSecret: orderPayments[0]!.clientSecret,
      orderIds,
      totalCents,
    };
  }

  // Multi-seller checkout: return all payment info
  return {
    success: true,
    orderPayments,
    orderIds,
    totalCents,
  };
}
