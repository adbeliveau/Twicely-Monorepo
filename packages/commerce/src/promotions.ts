/**
 * Promotion Engine — Pure functions for discount calculation, eligibility, and stacking rules.
 * No database access. Takes data in, returns results.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type PromotionType = 'PERCENT_OFF' | 'AMOUNT_OFF' | 'FREE_SHIPPING' | 'BUNDLE_DISCOUNT';
export type PromotionScope = 'STORE_WIDE' | 'CATEGORY' | 'SPECIFIC_LISTINGS';

export interface PromotionData {
  id: string;
  sellerId: string;
  name: string;
  type: PromotionType;
  scope: PromotionScope;
  discountPercent: number | null;
  discountAmountCents: number | null;
  minimumOrderCents: number | null;
  maxUsesTotal: number | null;
  maxUsesPerBuyer: number;
  usageCount: number;
  couponCode: string | null;
  applicableCategoryIds: string[];
  applicableListingIds: string[];
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
}

export interface CartLineItem {
  listingId: string;
  categoryId: string;
  sellerId: string;
  priceCents: number;
  quantity: number;
}

export interface DiscountResult {
  promotionId: string;
  promotionName: string;
  type: PromotionType;
  discountCents: number;
  freeShipping: boolean;
  appliedToListingIds: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface StackingResult {
  valid: boolean;
  reason?: string;
}

// ─── Core Functions ────────────────────────────────────────────────────────

/** Checks if a promotion is currently active based on time constraints */
export function isPromotionActive(promo: PromotionData, now: Date = new Date()): boolean {
  if (!promo.isActive) return false;
  if (now < promo.startsAt) return false;
  if (promo.endsAt !== null && now >= promo.endsAt) return false;
  return true;
}

/** Checks buyer eligibility for a promotion */
export function checkBuyerEligibility(
  promo: PromotionData,
  buyerUsageCount: number,
  sellerCartTotalCents: number
): EligibilityResult {
  // Check global usage limit
  if (promo.maxUsesTotal !== null && promo.usageCount >= promo.maxUsesTotal) {
    return { eligible: false, reason: 'This promotion has reached its usage limit' };
  }

  // Check per-buyer usage limit
  if (buyerUsageCount >= promo.maxUsesPerBuyer) {
    return { eligible: false, reason: 'You have already used this coupon' };
  }

  // Check minimum order amount
  if (promo.minimumOrderCents !== null && promo.type !== 'BUNDLE_DISCOUNT') {
    if (sellerCartTotalCents < promo.minimumOrderCents) {
      const minDollars = (promo.minimumOrderCents / 100).toFixed(2);
      return { eligible: false, reason: `Minimum order of $${minDollars} required` };
    }
  }

  return { eligible: true };
}

/** Returns line items from the cart that match the promotion's scope */
export function getApplicableLineItems(promo: PromotionData, lineItems: CartLineItem[]): CartLineItem[] {
  // Filter to only items from this seller
  const sellerItems = lineItems.filter((item) => item.sellerId === promo.sellerId);

  switch (promo.scope) {
    case 'STORE_WIDE':
      return sellerItems;

    case 'CATEGORY':
      return sellerItems.filter((item) => promo.applicableCategoryIds.includes(item.categoryId));

    case 'SPECIFIC_LISTINGS':
      return sellerItems.filter((item) => promo.applicableListingIds.includes(item.listingId));

    default:
      return [];
  }
}

export interface DiscountOptions {
  /** System-wide bundle minimum items from platform_settings — required for BUNDLE_DISCOUNT type. */
  bundleMinItems?: number;
}

/** Calculates the discount for applicable items */
export function calculateDiscount(promo: PromotionData, applicableItems: CartLineItem[], options?: DiscountOptions): DiscountResult {
  const appliedToListingIds = applicableItems.map((item) => item.listingId);
  const baseResult: DiscountResult = {
    promotionId: promo.id,
    promotionName: promo.name,
    type: promo.type,
    discountCents: 0,
    freeShipping: false,
    appliedToListingIds,
  };

  if (applicableItems.length === 0) return baseResult;

  const totalCents = applicableItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const totalQuantity = applicableItems.reduce((sum, item) => sum + item.quantity, 0);

  switch (promo.type) {
    case 'PERCENT_OFF': {
      if (promo.discountPercent === null) return baseResult;
      // Calculate per-item discount and sum (rounded down per item)
      let totalDiscount = 0;
      for (const item of applicableItems) {
        const itemTotal = item.priceCents * item.quantity;
        const itemDiscount = Math.floor((itemTotal * promo.discountPercent) / 100);
        totalDiscount += itemDiscount;
      }
      return { ...baseResult, discountCents: totalDiscount };
    }

    case 'AMOUNT_OFF': {
      if (promo.discountAmountCents === null) return baseResult;
      // Fixed amount off, capped at total
      const discount = Math.min(promo.discountAmountCents, totalCents);
      return { ...baseResult, discountCents: discount };
    }

    case 'FREE_SHIPPING':
      return { ...baseResult, freeShipping: true };

    case 'BUNDLE_DISCOUNT': {
      if (promo.discountPercent === null) return baseResult;
      // minimumOrderCents is repurposed as minimum item count for BUNDLE_DISCOUNT
      const minItemCount = promo.minimumOrderCents ?? options?.bundleMinItems;
      if (minItemCount == null || totalQuantity < minItemCount) return baseResult;
      // Apply percentage discount to all applicable items
      let totalDiscount = 0;
      for (const item of applicableItems) {
        const itemTotal = item.priceCents * item.quantity;
        const itemDiscount = Math.floor((itemTotal * promo.discountPercent) / 100);
        totalDiscount += itemDiscount;
      }
      return { ...baseResult, discountCents: totalDiscount };
    }

    default:
      return baseResult;
  }
}

/** Validates that promotions can be stacked together */
export function checkStackingRules(promotions: PromotionData[]): StackingResult {
  // Count how many promotions have a coupon code
  const couponCodePromos = promotions.filter((p) => p.couponCode !== null);

  // Only one coupon code allowed per checkout
  if (couponCodePromos.length > 1) {
    return { valid: false, reason: 'Only one coupon code can be applied per checkout' };
  }

  // BUNDLE_DISCOUNT without coupon code stacks with coupon codes — OK
  // STORE_WIDE without coupon code stacks with coupon codes — OK
  // Both are handled by the single coupon limit above

  return { valid: true };
}

/** Validates coupon code format: 4-20 chars, alphanumeric + hyphens, no leading/trailing hyphens */
export function validateCouponCodeFormat(code: string): boolean {
  const upperCode = code.toUpperCase();
  // Min 4 chars, max 20 chars, alphanumeric + hyphens, no leading/trailing hyphens
  return /^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$/.test(upperCode);
}

/** Normalizes a coupon code to uppercase */
export function normalizeCouponCode(code: string): string {
  return code.toUpperCase().trim();
}
