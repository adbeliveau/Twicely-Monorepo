import { db } from '@twicely/db';
import { promotion, promotionUsage } from '@twicely/db/schema';
import { eq, and, sql, desc, gt, lt, or, isNull } from 'drizzle-orm';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PromotionRow {
  id: string;
  sellerId: string;
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
  applicableCategoryIds: string[];
  applicableListingIds: string[];
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionStats {
  totalUses: number;
  totalDiscountCents: number;
}

export type PromotionStatus = 'active' | 'scheduled' | 'ended' | 'all';

// ─── Queries ───────────────────────────────────────────────────────────────

/** Get all promotions for a seller with optional status filter */
export async function getSellerPromotions(
  sellerId: string,
  options: { status?: PromotionStatus } = {}
): Promise<PromotionRow[]> {
  const status = options.status ?? 'all';
  const now = new Date();

  let conditions;
  switch (status) {
    case 'active':
      // Active: isActive AND startsAt <= now AND (endsAt is null OR endsAt > now)
      conditions = and(
        eq(promotion.sellerId, sellerId),
        eq(promotion.isActive, true),
        lt(promotion.startsAt, now),
        or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
      );
      break;

    case 'scheduled':
      // Scheduled: isActive AND startsAt > now
      conditions = and(
        eq(promotion.sellerId, sellerId),
        eq(promotion.isActive, true),
        gt(promotion.startsAt, now)
      );
      break;

    case 'ended':
      // Ended: NOT isActive OR (endsAt is not null AND endsAt <= now)
      conditions = and(
        eq(promotion.sellerId, sellerId),
        or(eq(promotion.isActive, false), and(lt(promotion.endsAt, now)))
      );
      break;

    default:
      // All
      conditions = eq(promotion.sellerId, sellerId);
  }

  const rows = await db
    .select()
    .from(promotion)
    .where(conditions)
    .orderBy(desc(promotion.createdAt))
    .limit(100);

  return rows;
}

/** Get a single promotion by ID with ownership check */
export async function getPromotionById(
  promotionId: string,
  sellerId: string
): Promise<PromotionRow | null> {
  const [row] = await db
    .select()
    .from(promotion)
    .where(and(eq(promotion.id, promotionId), eq(promotion.sellerId, sellerId)))
    .limit(1);

  return row ?? null;
}

/** Get number of times a buyer has used a specific promotion */
export async function getPromotionUsageCount(
  promotionId: string,
  buyerId: string
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promotionUsage)
    .where(and(eq(promotionUsage.promotionId, promotionId), eq(promotionUsage.buyerId, buyerId)));

  return result?.count ?? 0;
}

/** Find a promotion by coupon code (case-insensitive, must be active) */
export async function findCouponByCode(code: string): Promise<PromotionRow | null> {
  const upperCode = code.toUpperCase().trim();
  if (!upperCode) return null;

  const [row] = await db
    .select()
    .from(promotion)
    .where(and(eq(promotion.couponCode, upperCode), eq(promotion.isActive, true)))
    .limit(1);

  return row ?? null;
}

/** Get promotion usage statistics */
export async function getPromotionStats(promotionId: string): Promise<PromotionStats> {
  const [result] = await db
    .select({
      totalUses: sql<number>`count(*)::int`,
      totalDiscountCents: sql<number>`coalesce(sum(${promotionUsage.discountCents}), 0)::int`,
    })
    .from(promotionUsage)
    .where(eq(promotionUsage.promotionId, promotionId));

  return {
    totalUses: result?.totalUses ?? 0,
    totalDiscountCents: result?.totalDiscountCents ?? 0,
  };
}

/** Check if a coupon code already exists (for uniqueness validation) */
export async function couponCodeExists(
  code: string,
  excludePromotionId?: string
): Promise<boolean> {
  const upperCode = code.toUpperCase().trim();
  if (!upperCode) return false;

  let conditions = eq(promotion.couponCode, upperCode);
  if (excludePromotionId) {
    conditions = and(conditions, sql`${promotion.id} != ${excludePromotionId}`) as typeof conditions;
  }

  const [row] = await db
    .select({ id: promotion.id })
    .from(promotion)
    .where(conditions)
    .limit(1);

  return row !== undefined;
}

/** Count active promotions for a seller (for limit enforcement) */
export async function countActivePromotions(sellerId: string): Promise<number> {
  const now = new Date();

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promotion)
    .where(
      and(
        eq(promotion.sellerId, sellerId),
        eq(promotion.isActive, true),
        lt(promotion.startsAt, now),
        or(isNull(promotion.endsAt), gt(promotion.endsAt, now))
      )
    );

  return result?.count ?? 0;
}

/** Get a promotion by ID without ownership check (for internal use) */
export async function getPromotionByIdInternal(promotionId: string): Promise<PromotionRow | null> {
  const [row] = await db.select().from(promotion).where(eq(promotion.id, promotionId)).limit(1);
  return row ?? null;
}
