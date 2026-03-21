import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '@twicely/db';
import { promoCode, promoCodeRedemption } from '@twicely/db/schema';

export type PromoCodeRow = typeof promoCode.$inferSelect;

/**
 * Get all promo codes for an affiliate (seller dashboard).
 */
export async function getAffiliatePromoCodes(
  affiliateId: string,
): Promise<PromoCodeRow[]> {
  return db
    .select()
    .from(promoCode)
    .where(eq(promoCode.affiliateId, affiliateId))
    .orderBy(desc(promoCode.createdAt));
}

/**
 * Get a single promo code by ID.
 */
export async function getPromoCodeById(
  id: string,
): Promise<PromoCodeRow | null> {
  const [row] = await db
    .select()
    .from(promoCode)
    .where(eq(promoCode.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Get a promo code by its code string (for validation).
 * Codes are stored uppercased — caller should uppercase before querying.
 */
export async function getPromoCodeByCode(
  code: string,
): Promise<PromoCodeRow | null> {
  const [row] = await db
    .select()
    .from(promoCode)
    .where(eq(promoCode.code, code))
    .limit(1);
  return row ?? null;
}

/**
 * Get all platform promo codes (admin dashboard), paginated.
 */
export async function getPlatformPromoCodes(options: {
  limit: number;
  offset: number;
}): Promise<{ rows: PromoCodeRow[]; total: number }> {
  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(promoCode)
      .where(eq(promoCode.type, 'PLATFORM'))
      .orderBy(desc(promoCode.createdAt))
      .limit(options.limit)
      .offset(options.offset),

    db
      .select({ total: count() })
      .from(promoCode)
      .where(eq(promoCode.type, 'PLATFORM')),
  ]);

  return { rows, total: totalResult[0]?.total ?? 0 };
}

/**
 * Get all promo codes for admin (both AFFILIATE and PLATFORM), paginated.
 */
export async function getAllPromoCodes(options: {
  limit: number;
  offset: number;
  type?: 'AFFILIATE' | 'PLATFORM';
}): Promise<{ rows: PromoCodeRow[]; total: number }> {
  const condition = options.type
    ? eq(promoCode.type, options.type)
    : undefined;

  const [rows, totalResult] = await Promise.all([
    condition
      ? db
          .select()
          .from(promoCode)
          .where(condition)
          .orderBy(desc(promoCode.createdAt))
          .limit(options.limit)
          .offset(options.offset)
      : db
          .select()
          .from(promoCode)
          .orderBy(desc(promoCode.createdAt))
          .limit(options.limit)
          .offset(options.offset),

    condition
      ? db.select({ total: count() }).from(promoCode).where(condition)
      : db.select({ total: count() }).from(promoCode),
  ]);

  return { rows, total: totalResult[0]?.total ?? 0 };
}

/**
 * Check if a user has already redeemed a promo code for a product.
 */
export async function hasUserRedeemedPromoCode(
  promoCodeId: string,
  userId: string,
  product: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: promoCodeRedemption.id })
    .from(promoCodeRedemption)
    .where(
      and(
        eq(promoCodeRedemption.promoCodeId, promoCodeId),
        eq(promoCodeRedemption.userId, userId),
        eq(promoCodeRedemption.subscriptionProduct, product),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Get redemption count for a promo code.
 */
export async function getPromoCodeRedemptionCount(
  promoCodeId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(promoCodeRedemption)
    .where(eq(promoCodeRedemption.promoCodeId, promoCodeId));
  return row?.total ?? 0;
}
