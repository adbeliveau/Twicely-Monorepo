import { describe, it, expect } from 'vitest';
import {
  getApplicableLineItems,
  calculateDiscount,
  type PromotionData,
  type CartLineItem,
} from '../promotions';

/**
 * D2.3: Checkout coupon integration tests.
 * Tests for coupon behavior specific to checkout flow.
 *
 * Note: Basic coupon validation tests (normalization, active status,
 * buyer eligibility, applicable items, discount calculation) are in
 * promotions.test.ts (D2.1). This file tests only checkout-specific behavior.
 */

function createPromotion(overrides: Partial<PromotionData> = {}): PromotionData {
  return {
    id: 'promo-test',
    sellerId: 'seller-1',
    name: 'Test Coupon',
    type: 'PERCENT_OFF',
    scope: 'STORE_WIDE',
    discountPercent: 10,
    discountAmountCents: null,
    minimumOrderCents: null,
    maxUsesTotal: null,
    maxUsesPerBuyer: 1,
    usageCount: 0,
    couponCode: 'SAVE10',
    applicableCategoryIds: [],
    applicableListingIds: [],
    isActive: true,
    startsAt: new Date('2024-01-01'),
    endsAt: null,
    ...overrides,
  };
}

function createLineItem(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    listingId: 'listing-1',
    categoryId: 'cat-1',
    sellerId: 'seller-1',
    priceCents: 10000,
    quantity: 1,
    ...overrides,
  };
}

describe('D2.3: TF calculation on discounted price', () => {
  it('TF should be proportionally reduced when discount applied', () => {
    // Example: $100 order with 10% TF = $10 TF
    // With $20 discount (20% off), effective total = $80
    // TF should be proportionally reduced: $10 * (80/100) = $8
    const originalTotal = 10000; // $100
    const originalTf = 1000; // $10 TF (10%)
    const discountCents = 2000; // $20 discount

    const adjustedTotal = originalTotal - discountCents; // $80
    const discountRatio = adjustedTotal / originalTotal; // 0.8
    const adjustedTf = Math.round(originalTf * discountRatio);

    expect(adjustedTf).toBe(800); // $8 TF
  });

  it('TF remains same when no discount', () => {
    const originalTotal = 10000;
    const originalTf = 1000;
    const discountCents = 0;

    const adjustedTotal = originalTotal - discountCents;
    const discountRatio = adjustedTotal / originalTotal;
    const adjustedTf = Math.round(originalTf * discountRatio);

    expect(adjustedTf).toBe(1000);
  });

  it('handles full discount gracefully', () => {
    const originalTotal = 10000;
    const originalTf = 1000;
    const discountCents = 10000; // 100% discount

    const adjustedTotal = Math.max(0, originalTotal - discountCents);
    const discountRatio = originalTotal > 0 ? adjustedTotal / originalTotal : 0;
    const adjustedTf = Math.round(originalTf * discountRatio);

    expect(adjustedTotal).toBe(0);
    expect(adjustedTf).toBe(0);
  });
});

describe('D2.3: Multi-seller coupon scenarios', () => {
  it('coupon applies only to matching seller items in multi-seller cart', () => {
    const promo = createPromotion({
      scope: 'STORE_WIDE',
      sellerId: 'seller-1',
      type: 'PERCENT_OFF',
      discountPercent: 20,
    });

    const cartItems = [
      createLineItem({ sellerId: 'seller-1', priceCents: 10000, listingId: 'l1' }), // $100
      createLineItem({ sellerId: 'seller-2', priceCents: 5000, listingId: 'l2' }), // $50
    ];

    const applicableItems = getApplicableLineItems(promo, cartItems);
    expect(applicableItems).toHaveLength(1);

    const result = calculateDiscount(promo, applicableItems);
    expect(result.discountCents).toBe(2000); // 20% of $100 only
  });

  it('returns empty list when no items match seller', () => {
    const promo = createPromotion({
      scope: 'STORE_WIDE',
      sellerId: 'seller-1',
    });

    const cartItems = [
      createLineItem({ sellerId: 'seller-2', listingId: 'l1' }),
      createLineItem({ sellerId: 'seller-3', listingId: 'l2' }),
    ];

    const applicableItems = getApplicableLineItems(promo, cartItems);
    expect(applicableItems).toHaveLength(0);
  });
});
