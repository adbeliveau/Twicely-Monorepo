/**
 * Admin Seller Queries (I2.1)
 * Seller management list and verification queue for /usr/sellers
 */

import { db } from '@twicely/db';
import { user, sellerProfile, sellerBalance } from '@twicely/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { eq, and, or, ilike, count, desc, asc, isNull, inArray, sql } from 'drizzle-orm';

type StoreTier = InferSelectModel<typeof sellerProfile>['storeTier'];
type ListerTier = InferSelectModel<typeof sellerProfile>['listerTier'];
type PerformanceBand = InferSelectModel<typeof sellerProfile>['performanceBand'];
type SellerStatus = InferSelectModel<typeof sellerProfile>['status'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminSellerListOpts {
  page: number;
  pageSize: number;
  search?: string;
  sellerType?: 'PERSONAL' | 'BUSINESS';
  storeTier?: StoreTier;
  listerTier?: ListerTier;
  performanceBand?: PerformanceBand;
  status?: SellerStatus;
  sort?: 'newest' | 'oldest' | 'name' | 'score';
}

export interface SellerListItem {
  userId: string;
  name: string;
  email: string;
  sellerType: string;
  storeTier: string;
  listerTier: string;
  performanceBand: string;
  sellerScore: number;
  status: string;
  availableCents: number;
  activatedAt: Date | null;
  verifiedAt: Date | null;
  stripeOnboarded: boolean;
}

export interface VerificationQueueItem {
  userId: string;
  name: string;
  email: string;
  sellerType: string;
  storeTier: string;
  verifiedAt: Date | null;
  status: string;
  enforcementLevel: string | null;
  activatedAt: Date | null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAdminSellerList(
  opts: AdminSellerListOpts
): Promise<{ sellers: SellerListItem[]; total: number }> {
  const { page, pageSize, search, sellerType, storeTier, listerTier, performanceBand, status, sort } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(or(
      ilike(user.name, `%${search}%`),
      ilike(user.email, `%${search}%`),
      ilike(user.username, `%${search}%`)
    ));
  }
  if (sellerType) conditions.push(eq(sellerProfile.sellerType, sellerType));
  if (storeTier) conditions.push(eq(sellerProfile.storeTier, storeTier));
  if (listerTier) conditions.push(eq(sellerProfile.listerTier, listerTier));
  if (performanceBand) conditions.push(eq(sellerProfile.performanceBand, performanceBand));
  if (status) conditions.push(eq(sellerProfile.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy = sort === 'oldest'
    ? asc(sellerProfile.activatedAt)
    : sort === 'name'
      ? asc(user.name)
      : sort === 'score'
        ? desc(sellerProfile.sellerScore)
        : desc(sellerProfile.activatedAt);

  const [totalResult] = await db
    .select({ count: count() })
    .from(sellerProfile)
    .innerJoin(user, eq(user.id, sellerProfile.userId))
    .where(where);

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      sellerType: sellerProfile.sellerType,
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      performanceBand: sellerProfile.performanceBand,
      sellerScore: sellerProfile.sellerScore,
      status: sellerProfile.status,
      availableCents: sql<number>`COALESCE(${sellerBalance.availableCents}, 0)`,
      activatedAt: sellerProfile.activatedAt,
      verifiedAt: sellerProfile.verifiedAt,
      stripeOnboarded: sellerProfile.stripeOnboarded,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(user.id, sellerProfile.userId))
    .leftJoin(sellerBalance, eq(sellerBalance.userId, user.id))
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  return {
    sellers: rows.map((r) => ({ ...r, availableCents: Number(r.availableCents) })),
    total: totalResult?.count ?? 0,
  };
}

export async function getAdminVerificationQueue(): Promise<VerificationQueueItem[]> {
  const HIGH_TIERS: StoreTier[] = ['PRO', 'POWER', 'ENTERPRISE'];

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      sellerType: sellerProfile.sellerType,
      storeTier: sellerProfile.storeTier,
      verifiedAt: sellerProfile.verifiedAt,
      status: sellerProfile.status,
      enforcementLevel: sellerProfile.enforcementLevel,
      activatedAt: sellerProfile.activatedAt,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(user.id, sellerProfile.userId))
    .where(
      or(
        and(
          inArray(sellerProfile.storeTier, HIGH_TIERS),
          isNull(sellerProfile.verifiedAt)
        ),
        eq(sellerProfile.status, 'RESTRICTED')
      )
    )
    .orderBy(
      desc(isNull(sellerProfile.verifiedAt)),
      desc(sellerProfile.activatedAt)
    );

  return rows;
}
