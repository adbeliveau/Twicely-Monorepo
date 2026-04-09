'use server';

/**
 * Coupon validation helpers for checkout.
 * Split from checkout.ts to stay under 300 lines.
 */

import { db } from '@twicely/db';
import { promotion } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

interface CouponData {
  promotionId: string;
  couponCode: string;
  discountCents: number;
  freeShipping: boolean;
  appliedToSellerId: string;
}

interface CreatedOrder {
  id: string;
  sellerId: string;
  totalCents: number;
}

interface CouponValidationResult {
  valid: boolean;
  error?: string;
  verifiedDiscountCents: number;
}

/**
 * Server-side coupon validation and discount computation.
 * SECURITY: Re-validates the promotionId and recomputes discountCents to
 * prevent PaymentIntent metadata tampering (SEC-017).
 */
export async function validateAndComputeCoupon(
  coupon: CouponData,
  createdOrders: CreatedOrder[],
): Promise<CouponValidationResult> {
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
    .where(eq(promotion.id, coupon.promotionId))
    .limit(1);

  if (!promo || !promo.isActive || promo.startsAt > now || (promo.endsAt && promo.endsAt < now)) {
    return { valid: false, error: 'Coupon is no longer valid', verifiedDiscountCents: 0 };
  }
  if (promo.couponCode !== coupon.couponCode) {
    return { valid: false, error: 'Invalid coupon code', verifiedDiscountCents: 0 };
  }
  if (promo.maxUsesTotal && promo.usageCount >= promo.maxUsesTotal) {
    return { valid: false, error: 'Coupon usage limit reached', verifiedDiscountCents: 0 };
  }

  // Recompute discount server-side from promotion data
  let verifiedDiscountCents = 0;
  const applicableOrder = createdOrders.find((o) => o.sellerId === coupon.appliedToSellerId);
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

  return { valid: true, verifiedDiscountCents };
}
