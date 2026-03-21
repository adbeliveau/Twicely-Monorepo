// Types for admin promotions queries (I9)

export interface PromotionWithSellerRow {
  id: string;
  sellerId: string;
  sellerUsername: string | null;
  sellerDisplayName: string | null;
  name: string;
  type: string;
  scope: string;
  discountPercent: number | null;
  discountAmountCents: number | null;
  minimumOrderCents: number | null;
  maxUsesTotal: number | null;
  maxUsesPerBuyer: number;
  usageCount: number;
  couponCode: string | null;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
}

export interface PromoCodeWithContextRow {
  id: string;
  code: string;
  type: string;
  affiliateId: string | null;
  affiliateUsername: string | null;
  discountType: string;
  discountValue: number;
  durationMonths: number;
  scopeProductTypes: unknown;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface PromotionUsageRow {
  id: string;
  promotionId: string;
  orderId: string;
  orderNumber: string | null;
  buyerId: string;
  buyerUsername: string | null;
  discountCents: number;
  createdAt: Date;
}

export interface PromoCodeRedemptionRow {
  id: string;
  promoCodeId: string;
  userId: string;
  username: string | null;
  subscriptionProduct: string;
  discountAppliedCents: number;
  monthsRemaining: number;
  createdAt: Date;
}

export interface PromotionsOverviewStats {
  activeSellerPromotions: number;
  activePromoCodes: number;
  totalRedemptions: number;
  totalDiscountCents: number;
}
