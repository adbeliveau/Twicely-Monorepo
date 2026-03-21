import { describe, it, expect } from 'vitest';
import {
  isPromotionActive, checkBuyerEligibility, getApplicableLineItems,
  calculateDiscount, checkStackingRules, validateCouponCodeFormat, normalizeCouponCode,
  type PromotionData, type CartLineItem,
} from '../promotions';

function createPromotion(overrides: Partial<PromotionData> = {}): PromotionData {
  return {
    id: 'promo-1', sellerId: 'seller-1', name: 'Test Promo', type: 'PERCENT_OFF', scope: 'STORE_WIDE',
    discountPercent: 20, discountAmountCents: null, minimumOrderCents: null, maxUsesTotal: null,
    maxUsesPerBuyer: 1, usageCount: 0, couponCode: null, applicableCategoryIds: [], applicableListingIds: [],
    isActive: true, startsAt: new Date('2024-01-01'), endsAt: null, ...overrides,
  };
}

function createLineItem(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return { listingId: 'listing-1', categoryId: 'cat-1', sellerId: 'seller-1', priceCents: 10000, quantity: 1, ...overrides };
}

describe('isPromotionActive', () => {
  it('returns true when active, started, no end date', () => {
    const promo = createPromotion({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: null });
    expect(isPromotionActive(promo, new Date('2024-06-15'))).toBe(true);
  });
  it('returns true when active, started, end date in future', () => {
    const promo = createPromotion({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: new Date('2024-12-31') });
    expect(isPromotionActive(promo, new Date('2024-06-15'))).toBe(true);
  });
  it('returns false when isActive is false', () => {
    const promo = createPromotion({ isActive: false, startsAt: new Date('2024-01-01'), endsAt: null });
    expect(isPromotionActive(promo, new Date('2024-06-15'))).toBe(false);
  });
  it('returns false when startsAt is in the future', () => {
    const promo = createPromotion({ isActive: true, startsAt: new Date('2025-01-01'), endsAt: null });
    expect(isPromotionActive(promo, new Date('2024-06-15'))).toBe(false);
  });
  it('returns false when endsAt is in the past', () => {
    const promo = createPromotion({ isActive: true, startsAt: new Date('2024-01-01'), endsAt: new Date('2024-03-01') });
    expect(isPromotionActive(promo, new Date('2024-06-15'))).toBe(false);
  });
});

describe('checkBuyerEligibility', () => {
  it('returns eligible when all checks pass', () => {
    const promo = createPromotion({ maxUsesTotal: 100, usageCount: 50, maxUsesPerBuyer: 3, minimumOrderCents: 5000 });
    expect(checkBuyerEligibility(promo, 1, 10000).eligible).toBe(true);
  });
  it('fails when usageCount >= maxUsesTotal', () => {
    const promo = createPromotion({ maxUsesTotal: 100, usageCount: 100 });
    const result = checkBuyerEligibility(promo, 0, 10000);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('usage limit');
  });
  it('fails when buyerUsageCount >= maxUsesPerBuyer', () => {
    const result = checkBuyerEligibility(createPromotion({ maxUsesPerBuyer: 1 }), 1, 10000);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('already used');
  });
  it('fails when cart total below minimumOrderCents', () => {
    const result = checkBuyerEligibility(createPromotion({ minimumOrderCents: 10000 }), 0, 5000);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Minimum order');
  });
  it('passes when maxUsesTotal is null (unlimited)', () => {
    expect(checkBuyerEligibility(createPromotion({ maxUsesTotal: null, usageCount: 999 }), 0, 10000).eligible).toBe(true);
  });
  it('passes when minimumOrderCents is null (no minimum)', () => {
    expect(checkBuyerEligibility(createPromotion({ minimumOrderCents: null }), 0, 100).eligible).toBe(true);
  });
});

describe('getApplicableLineItems', () => {
  it('STORE_WIDE returns all items from matching seller', () => {
    const promo = createPromotion({ scope: 'STORE_WIDE', sellerId: 'seller-1' });
    const items = [createLineItem({ sellerId: 'seller-1', listingId: 'l1' }), createLineItem({ sellerId: 'seller-1', listingId: 'l2' })];
    expect(getApplicableLineItems(promo, items)).toHaveLength(2);
  });
  it('STORE_WIDE excludes items from different seller', () => {
    const promo = createPromotion({ scope: 'STORE_WIDE', sellerId: 'seller-1' });
    const items = [createLineItem({ sellerId: 'seller-1', listingId: 'l1' }), createLineItem({ sellerId: 'seller-2', listingId: 'l2' })];
    const result = getApplicableLineItems(promo, items);
    expect(result).toHaveLength(1);
    expect(result[0]?.listingId).toBe('l1');
  });
  it('CATEGORY filters by categoryId', () => {
    const promo = createPromotion({ scope: 'CATEGORY', sellerId: 'seller-1', applicableCategoryIds: ['cat-electronics'] });
    const items = [createLineItem({ sellerId: 'seller-1', categoryId: 'cat-electronics', listingId: 'l1' }),
      createLineItem({ sellerId: 'seller-1', categoryId: 'cat-clothing', listingId: 'l2' })];
    const result = getApplicableLineItems(promo, items);
    expect(result).toHaveLength(1);
    expect(result[0]?.categoryId).toBe('cat-electronics');
  });
  it('SPECIFIC_LISTINGS filters by listingId', () => {
    const promo = createPromotion({ scope: 'SPECIFIC_LISTINGS', sellerId: 'seller-1', applicableListingIds: ['l1', 'l3'] });
    const items = [createLineItem({ sellerId: 'seller-1', listingId: 'l1' }),
      createLineItem({ sellerId: 'seller-1', listingId: 'l2' }), createLineItem({ sellerId: 'seller-1', listingId: 'l3' })];
    expect(getApplicableLineItems(promo, items)).toHaveLength(2);
  });
});

describe('calculateDiscount', () => {
  it('PERCENT_OFF: 20% of $100 = $20.00 (2000 cents)', () => {
    const result = calculateDiscount(createPromotion({ type: 'PERCENT_OFF', discountPercent: 20 }), [createLineItem({ priceCents: 10000, quantity: 1 })]);
    expect(result.discountCents).toBe(2000);
    expect(result.freeShipping).toBe(false);
  });
  it('PERCENT_OFF: rounds down per item', () => {
    const result = calculateDiscount(createPromotion({ type: 'PERCENT_OFF', discountPercent: 33 }), [createLineItem({ priceCents: 100, quantity: 1 })]);
    expect(result.discountCents).toBe(33);
  });
  it('AMOUNT_OFF: $10 off $100 = $10.00 discount', () => {
    const result = calculateDiscount(createPromotion({ type: 'AMOUNT_OFF', discountAmountCents: 1000 }), [createLineItem({ priceCents: 10000, quantity: 1 })]);
    expect(result.discountCents).toBe(1000);
  });
  it('AMOUNT_OFF: caps at item total', () => {
    const result = calculateDiscount(createPromotion({ type: 'AMOUNT_OFF', discountAmountCents: 5000 }), [createLineItem({ priceCents: 2000, quantity: 1 })]);
    expect(result.discountCents).toBe(2000);
  });
  it('FREE_SHIPPING: returns discountCents=0, freeShipping=true', () => {
    const result = calculateDiscount(createPromotion({ type: 'FREE_SHIPPING' }), [createLineItem({ priceCents: 10000, quantity: 1 })]);
    expect(result.discountCents).toBe(0);
    expect(result.freeShipping).toBe(true);
  });
  it('BUNDLE_DISCOUNT: 2 items at 10% = applied; 1 item = not applied', () => {
    const promo = createPromotion({ type: 'BUNDLE_DISCOUNT', discountPercent: 10, minimumOrderCents: 2 });
    expect(calculateDiscount(promo, [createLineItem({ priceCents: 5000, quantity: 1 })]).discountCents).toBe(0);
    expect(calculateDiscount(promo, [createLineItem({ priceCents: 5000, quantity: 2 })]).discountCents).toBe(1000);
  });
  it('returns zero discount for empty applicable items', () => {
    expect(calculateDiscount(createPromotion({ type: 'PERCENT_OFF', discountPercent: 20 }), []).discountCents).toBe(0);
  });
});

describe('checkStackingRules', () => {
  it('two coupon-code promotions → invalid', () => {
    const result = checkStackingRules([createPromotion({ couponCode: 'CODE1' }), createPromotion({ couponCode: 'CODE2' })]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('one coupon code');
  });
  it('coupon + BUNDLE_DISCOUNT (no code) → valid', () => {
    const result = checkStackingRules([createPromotion({ type: 'PERCENT_OFF', couponCode: 'SAVE20' }), createPromotion({ type: 'BUNDLE_DISCOUNT', couponCode: null })]);
    expect(result.valid).toBe(true);
  });
  it('coupon + STORE_WIDE sale (no code) → valid', () => {
    const result = checkStackingRules([createPromotion({ type: 'PERCENT_OFF', couponCode: 'SAVE20' }), createPromotion({ scope: 'STORE_WIDE', couponCode: null })]);
    expect(result.valid).toBe(true);
  });
  it('single coupon code is valid', () => {
    expect(checkStackingRules([createPromotion({ couponCode: 'CODE1' })]).valid).toBe(true);
  });
  it('no promotions is valid', () => {
    expect(checkStackingRules([]).valid).toBe(true);
  });
});

describe('validateCouponCodeFormat', () => {
  it('valid: "SPRING20" → true', () => { expect(validateCouponCodeFormat('SPRING20')).toBe(true); });
  it('valid: "VINTAGE-DEALS" → true', () => { expect(validateCouponCodeFormat('VINTAGE-DEALS')).toBe(true); });
  it('invalid: "ab" (too short) → false', () => { expect(validateCouponCodeFormat('ab')).toBe(false); });
  it('invalid: "-STARTS-WITH-DASH" → false', () => { expect(validateCouponCodeFormat('-STARTS-WITH-DASH')).toBe(false); });
  it('invalid: "ENDS-WITH-DASH-" → false', () => { expect(validateCouponCodeFormat('ENDS-WITH-DASH-')).toBe(false); });
  it('valid: lowercase is auto-uppercased', () => { expect(validateCouponCodeFormat('save20')).toBe(true); });
  it('invalid: "A" (too short) → false', () => { expect(validateCouponCodeFormat('A')).toBe(false); });
  it('valid: exactly 4 characters "ABCD"', () => { expect(validateCouponCodeFormat('ABCD')).toBe(true); });
  it('valid: exactly 20 characters', () => { expect(validateCouponCodeFormat('ABCDEFGHIJ1234567890')).toBe(true); });
});

describe('normalizeCouponCode', () => {
  it('uppercases lowercase input', () => { expect(normalizeCouponCode('spring20')).toBe('SPRING20'); });
  it('trims whitespace', () => { expect(normalizeCouponCode('  CODE  ')).toBe('CODE'); });
  it('handles mixed case', () => { expect(normalizeCouponCode('SaVe20')).toBe('SAVE20'); });
});
