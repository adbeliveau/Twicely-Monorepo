'use server';

import { authorize } from '@twicely/casl';
import { findCouponByCode, getPromotionUsageCount } from '@/lib/queries/promotions';
import {
  isPromotionActive,
  checkBuyerEligibility,
  getApplicableLineItems,
  calculateDiscount,
  normalizeCouponCode,
  type CartLineItem,
  type PromotionData,
} from '@twicely/commerce/promotions';
import { applyCouponSchema } from '@/lib/validations/coupon';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

interface ApplyCouponInput {
  couponCode: string;
  cartItems: Array<{
    listingId: string;
    categoryId: string;
    sellerId: string;
    priceCents: number;
    quantity: number;
  }>;
}

interface ApplyCouponResult {
  success: boolean;
  error?: string;
  discount?: {
    promotionId: string;
    promotionName: string;
    type: string;
    discountCents: number;
    freeShipping: boolean;
    appliedToSellerId: string;
    appliedToListingIds: string[];
  };
}

export async function applyCoupon(input: ApplyCouponInput): Promise<ApplyCouponResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to apply a coupon' };
  }
  if (!ability.can('update', 'Cart')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = applyCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const buyerId = session.userId;
  const normalizedCode = normalizeCouponCode(parsed.data.couponCode);

  // Find the coupon
  const promoRow = await findCouponByCode(normalizedCode);
  if (!promoRow) {
    return { success: false, error: 'Invalid coupon code' };
  }

  // Convert row to PromotionData
  const promo: PromotionData = {
    id: promoRow.id,
    sellerId: promoRow.sellerId,
    name: promoRow.name,
    type: promoRow.type as PromotionData['type'],
    scope: promoRow.scope as PromotionData['scope'],
    discountPercent: promoRow.discountPercent,
    discountAmountCents: promoRow.discountAmountCents,
    minimumOrderCents: promoRow.minimumOrderCents,
    maxUsesTotal: promoRow.maxUsesTotal,
    maxUsesPerBuyer: promoRow.maxUsesPerBuyer,
    usageCount: promoRow.usageCount,
    couponCode: promoRow.couponCode,
    applicableCategoryIds: promoRow.applicableCategoryIds,
    applicableListingIds: promoRow.applicableListingIds,
    isActive: promoRow.isActive,
    startsAt: promoRow.startsAt,
    endsAt: promoRow.endsAt,
  };

  // Check if promotion is active
  if (!isPromotionActive(promo)) {
    return { success: false, error: 'This coupon has expired' };
  }

  // Get buyer usage count for per-buyer limit
  const buyerUsageCount = await getPromotionUsageCount(promo.id, buyerId);

  // Filter cart items for this seller
  const sellerItems = parsed.data.cartItems.filter((i) => i.sellerId === promo.sellerId);
  if (sellerItems.length === 0) {
    return { success: false, error: 'No items in your cart from this seller' };
  }

  // Calculate seller cart total
  const sellerCartTotal = sellerItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  // Check buyer eligibility
  const eligibility = checkBuyerEligibility(promo, buyerUsageCount, sellerCartTotal);
  if (!eligibility.eligible) {
    return { success: false, error: eligibility.reason ?? 'You are not eligible for this coupon' };
  }

  // Convert to CartLineItem format
  const cartLineItems: CartLineItem[] = sellerItems.map((i) => ({
    listingId: i.listingId,
    categoryId: i.categoryId,
    sellerId: i.sellerId,
    priceCents: i.priceCents,
    quantity: i.quantity,
  }));

  // Get applicable items based on scope
  const applicableItems = getApplicableLineItems(promo, cartLineItems);
  if (applicableItems.length === 0) {
    return { success: false, error: 'No items in your cart qualify for this coupon' };
  }

  // Calculate discount
  const bundleMinItems = await getPlatformSetting<number>('bundle.minItems', 2);
  const discountResult = calculateDiscount(promo, applicableItems, { bundleMinItems });

  return {
    success: true,
    discount: {
      promotionId: promo.id,
      promotionName: promo.name,
      type: promo.type,
      discountCents: discountResult.discountCents,
      freeShipping: discountResult.freeShipping,
      appliedToSellerId: promo.sellerId,
      appliedToListingIds: discountResult.appliedToListingIds,
    },
  };
}
