import { stripe } from './server';
import type Stripe from 'stripe';
import type { PromoCodeRow } from '@/lib/queries/promo-codes';

export interface StripePromoCodeIds {
  stripeCouponId: string;
  stripePromotionCodeId: string;
}

/**
 * Sync a promo code to Stripe by creating a Coupon + PromotionCode.
 *
 * PERCENTAGE: discountValue is BPS (1000 = 10%). Stripe percent_off = discountValue / 100.
 * FIXED: discountValue is cents. Stripe amount_off = discountValue (already cents).
 */
export async function syncPromoCodeToStripe(
  promo: PromoCodeRow,
): Promise<StripePromoCodeIds> {
  const couponBase: Stripe.CouponCreateParams = {
    duration: 'repeating',
    duration_in_months: promo.durationMonths,
    name: promo.code,
    metadata: { twicelyPromoCodeId: promo.id },
  };

  const couponParams: Stripe.CouponCreateParams =
    promo.discountType === 'PERCENTAGE'
      ? { ...couponBase, percent_off: promo.discountValue / 100 }
      : { ...couponBase, amount_off: promo.discountValue, currency: 'usd' };

  const coupon = await stripe.coupons.create(couponParams);

  const expiresAtUnix =
    promo.expiresAt !== null && promo.expiresAt !== undefined
      ? Math.floor(new Date(promo.expiresAt).getTime() / 1000)
      : undefined;

  // Stripe v20 PromotionCode API uses promotion.coupon instead of top-level coupon
  const promotionParams: Stripe.PromotionCodeCreateParams = {
    promotion: {
      type: 'coupon',
      coupon: coupon.id,
    },
    code: promo.code,
    metadata: { twicelyPromoCodeId: promo.id },
    ...(promo.usageLimit !== null && promo.usageLimit !== undefined
      ? { max_redemptions: promo.usageLimit }
      : {}),
    ...(expiresAtUnix !== undefined ? { expires_at: expiresAtUnix } : {}),
  };

  const promotionCode = await stripe.promotionCodes.create(promotionParams);

  return {
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promotionCode.id,
  };
}

/**
 * Deactivate a Stripe PromotionCode (disables it without deleting the Coupon).
 */
export async function deactivateStripePromotionCode(
  stripePromotionCodeId: string,
): Promise<void> {
  await stripe.promotionCodes.update(stripePromotionCodeId, { active: false });
}
