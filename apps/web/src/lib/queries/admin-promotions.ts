import { db } from '@twicely/db';
import { promotion, promotionUsage, promoCode, promoCodeRedemption, affiliate, user, order } from '@twicely/db/schema';
import { eq, and, sql, desc, gt, lt, or, isNull, ilike, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getPromotionStats } from './promotions';
import type { PromotionStats } from './promotions';

export type {
  PromotionWithSellerRow,
  PromoCodeWithContextRow,
  PromotionUsageRow,
  PromoCodeRedemptionRow,
  PromotionsOverviewStats,
} from './admin-promotions-types';

import type {
  PromotionWithSellerRow,
  PromoCodeWithContextRow,
  PromotionUsageRow,
  PromoCodeRedemptionRow,
  PromotionsOverviewStats,
} from './admin-promotions-types';

// ─── Query 1: getAllSellerPromotions ──────────────────────────────────────────

export async function getAllSellerPromotions(options: {
  limit: number; offset: number;
  status?: 'active' | 'scheduled' | 'ended' | 'all';
  sellerId?: string; search?: string;
}): Promise<{ rows: PromotionWithSellerRow[]; total: number }> {
  const { limit, offset, status = 'all', sellerId, search } = options;
  const now = new Date();
  const sellerUser = alias(user, 'seller_user');
  const conditions = [];

  if (sellerId) conditions.push(eq(promotion.sellerId, sellerId));
  if (search) conditions.push(or(ilike(promotion.name, `%${search}%`), ilike(promotion.couponCode, `%${search}%`)));

  switch (status) {
    case 'active':
      conditions.push(and(eq(promotion.isActive, true), lt(promotion.startsAt, now), or(isNull(promotion.endsAt), gt(promotion.endsAt, now))));
      break;
    case 'scheduled':
      conditions.push(and(eq(promotion.isActive, true), gt(promotion.startsAt, now)));
      break;
    case 'ended':
      conditions.push(or(eq(promotion.isActive, false), lt(promotion.endsAt, now)));
      break;
    default: break;
  }

  const where = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

  const promoFields = {
    id: promotion.id, sellerId: promotion.sellerId,
    sellerUsername: sellerUser.username, sellerDisplayName: sellerUser.displayName,
    name: promotion.name, type: promotion.type, scope: promotion.scope,
    discountPercent: promotion.discountPercent, discountAmountCents: promotion.discountAmountCents,
    minimumOrderCents: promotion.minimumOrderCents, maxUsesTotal: promotion.maxUsesTotal,
    maxUsesPerBuyer: promotion.maxUsesPerBuyer, usageCount: promotion.usageCount,
    couponCode: promotion.couponCode, isActive: promotion.isActive,
    startsAt: promotion.startsAt, endsAt: promotion.endsAt, createdAt: promotion.createdAt,
  } as const;

  const [rows, totalResult] = await Promise.all([
    db.select(promoFields).from(promotion).leftJoin(sellerUser, eq(promotion.sellerId, sellerUser.id)).where(where).orderBy(desc(promotion.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(promotion).leftJoin(sellerUser, eq(promotion.sellerId, sellerUser.id)).where(where),
  ]);

  return { rows, total: totalResult[0]?.total ?? 0 };
}

// ─── Query 2: getPromotionDetailAdmin ────────────────────────────────────────

export async function getPromotionDetailAdmin(
  promotionId: string,
): Promise<{ promotion: PromotionWithSellerRow; stats: PromotionStats; recentUsage: PromotionUsageRow[] } | null> {
  const sellerUser = alias(user, 'seller_user');
  const buyerUser = alias(user, 'buyer_user');

  const [row] = await db
    .select({
      id: promotion.id, sellerId: promotion.sellerId,
      sellerUsername: sellerUser.username, sellerDisplayName: sellerUser.displayName,
      name: promotion.name, type: promotion.type, scope: promotion.scope,
      discountPercent: promotion.discountPercent, discountAmountCents: promotion.discountAmountCents,
      minimumOrderCents: promotion.minimumOrderCents, maxUsesTotal: promotion.maxUsesTotal,
      maxUsesPerBuyer: promotion.maxUsesPerBuyer, usageCount: promotion.usageCount,
      couponCode: promotion.couponCode, isActive: promotion.isActive,
      startsAt: promotion.startsAt, endsAt: promotion.endsAt, createdAt: promotion.createdAt,
    })
    .from(promotion)
    .leftJoin(sellerUser, eq(promotion.sellerId, sellerUser.id))
    .where(eq(promotion.id, promotionId))
    .limit(1);

  if (!row) return null;

  const [stats, recentUsage] = await Promise.all([
    getPromotionStats(promotionId),
    db
      .select({
        id: promotionUsage.id, promotionId: promotionUsage.promotionId,
        orderId: promotionUsage.orderId, orderNumber: order.orderNumber,
        buyerId: promotionUsage.buyerId, buyerUsername: buyerUser.username,
        discountCents: promotionUsage.discountCents, createdAt: promotionUsage.createdAt,
      })
      .from(promotionUsage)
      .leftJoin(buyerUser, eq(promotionUsage.buyerId, buyerUser.id))
      .leftJoin(order, eq(promotionUsage.orderId, order.id))
      .where(eq(promotionUsage.promotionId, promotionId))
      .orderBy(desc(promotionUsage.createdAt))
      .limit(20),
  ]);

  return { promotion: row, stats, recentUsage };
}

// ─── Query 3: getAllPromoCodesAdmin ───────────────────────────────────────────

export async function getAllPromoCodesAdmin(options: {
  limit: number; offset: number;
  type?: 'AFFILIATE' | 'PLATFORM'; search?: string; isActive?: boolean;
}): Promise<{ rows: PromoCodeWithContextRow[]; total: number }> {
  const { limit, offset, type, search, isActive } = options;
  const affiliateUser = alias(user, 'affiliate_user');
  const conditions = [];

  if (type) conditions.push(eq(promoCode.type, type));
  if (search) conditions.push(ilike(promoCode.code, `%${search}%`));
  if (isActive !== undefined) conditions.push(eq(promoCode.isActive, isActive));

  const where = conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined;

  const codeFields = {
    id: promoCode.id, code: promoCode.code, type: promoCode.type,
    affiliateId: promoCode.affiliateId, affiliateUsername: affiliateUser.username,
    discountType: promoCode.discountType, discountValue: promoCode.discountValue,
    durationMonths: promoCode.durationMonths, scopeProductTypes: promoCode.scopeProductTypes,
    usageLimit: promoCode.usageLimit, usageCount: promoCode.usageCount,
    expiresAt: promoCode.expiresAt, isActive: promoCode.isActive, createdAt: promoCode.createdAt,
  } as const;

  const [rows, totalResult] = await Promise.all([
    db.select(codeFields).from(promoCode).leftJoin(affiliate, eq(promoCode.affiliateId, affiliate.id)).leftJoin(affiliateUser, eq(affiliate.userId, affiliateUser.id)).where(where).orderBy(desc(promoCode.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(promoCode).where(where),
  ]);

  return { rows, total: totalResult[0]?.total ?? 0 };
}

// ─── Query 4: getPromoCodeDetailAdmin ────────────────────────────────────────

export async function getPromoCodeDetailAdmin(
  promoCodeId: string,
): Promise<{ promoCode: PromoCodeWithContextRow; redemptions: PromoCodeRedemptionRow[]; redemptionCount: number } | null> {
  const affiliateUser = alias(user, 'affiliate_user');
  const redemptionUser = alias(user, 'redemption_user');

  const [row] = await db
    .select({
      id: promoCode.id, code: promoCode.code, type: promoCode.type,
      affiliateId: promoCode.affiliateId, affiliateUsername: affiliateUser.username,
      discountType: promoCode.discountType, discountValue: promoCode.discountValue,
      durationMonths: promoCode.durationMonths, scopeProductTypes: promoCode.scopeProductTypes,
      usageLimit: promoCode.usageLimit, usageCount: promoCode.usageCount,
      expiresAt: promoCode.expiresAt, isActive: promoCode.isActive, createdAt: promoCode.createdAt,
    })
    .from(promoCode)
    .leftJoin(affiliate, eq(promoCode.affiliateId, affiliate.id))
    .leftJoin(affiliateUser, eq(affiliate.userId, affiliateUser.id))
    .where(eq(promoCode.id, promoCodeId))
    .limit(1);

  if (!row) return null;

  const [redemptions, countResult] = await Promise.all([
    db
      .select({
        id: promoCodeRedemption.id, promoCodeId: promoCodeRedemption.promoCodeId,
        userId: promoCodeRedemption.userId, username: redemptionUser.username,
        subscriptionProduct: promoCodeRedemption.subscriptionProduct,
        discountAppliedCents: promoCodeRedemption.discountAppliedCents,
        monthsRemaining: promoCodeRedemption.monthsRemaining, createdAt: promoCodeRedemption.createdAt,
      })
      .from(promoCodeRedemption)
      .leftJoin(redemptionUser, eq(promoCodeRedemption.userId, redemptionUser.id))
      .where(eq(promoCodeRedemption.promoCodeId, promoCodeId))
      .orderBy(desc(promoCodeRedemption.createdAt))
      .limit(20),
    db.select({ total: count() }).from(promoCodeRedemption).where(eq(promoCodeRedemption.promoCodeId, promoCodeId)),
  ]);

  return { promoCode: row, redemptions, redemptionCount: countResult[0]?.total ?? 0 };
}

// ─── Query 5: getPromotionsOverviewStats ─────────────────────────────────────

export async function getPromotionsOverviewStats(): Promise<PromotionsOverviewStats> {
  const now = new Date();

  const [activePromos, activeCodes, redemptions, discounts] = await Promise.all([
    db.select({ total: count() }).from(promotion).where(and(eq(promotion.isActive, true), lt(promotion.startsAt, now), or(isNull(promotion.endsAt), gt(promotion.endsAt, now)))),
    db.select({ total: count() }).from(promoCode).where(eq(promoCode.isActive, true)),
    db.select({ total: count() }).from(promoCodeRedemption),
    db.select({ totalDiscountCents: sql<number>`coalesce(sum(${promotionUsage.discountCents}), 0)::int` }).from(promotionUsage),
  ]);

  return {
    activeSellerPromotions: activePromos[0]?.total ?? 0,
    activePromoCodes: activeCodes[0]?.total ?? 0,
    totalRedemptions: redemptions[0]?.total ?? 0,
    totalDiscountCents: discounts[0]?.totalDiscountCents ?? 0,
  };
}
