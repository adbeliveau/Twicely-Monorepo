/**
 * Admin Analytics — Seller & Cohort Queries (I10)
 * Split from admin-analytics.ts for file-size compliance.
 * Cohort retention analysis and seller performance table.
 */

import { db } from '@twicely/db';
import { order, user, sellerProfile, sellerPerformance } from '@twicely/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { sql, gte, lt, and, eq, count, desc, asc, ilike, or } from 'drizzle-orm';
import { escapeLike } from '@twicely/utils/escape-like';

type PerformanceBand = InferSelectModel<typeof sellerProfile>['performanceBand'];
type StoreTier = InferSelectModel<typeof sellerProfile>['storeTier'];

export interface CohortRow {
  cohortMonth: string;       // YYYY-MM
  cohortSize: number;        // users who signed up that month
  retentionPcts: number[];   // percentage retained in each subsequent month
}

export interface SellerAnalyticsParams {
  page: number;         // 1-indexed
  pageSize: number;     // default 25, max 100
  sortBy: 'gmv' | 'orders' | 'rating' | 'cancelRate' | 'returnRate' | 'createdAt';
  sortDir: 'asc' | 'desc';
  bandFilter?: PerformanceBand;
  tierFilter?: StoreTier;
  search?: string;
}

export interface SellerAnalyticsRow {
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  username: string | null;
  sellerType: string;
  storeTier: string;
  listerTier: string;
  performanceBand: string;
  status: string;
  totalOrders: number;
  completedOrders: number;
  cancelRate: number;
  returnRate: number;
  averageRating: number | null;
  totalReviews: number;
  lateShipmentRate: number;
  gmvCents: number;
  createdAt: Date;
}

export async function getUserCohortRetention(months: number): Promise<CohortRow[]> {
  // Build month series: last N months
  const now = new Date();
  const cohortMonths: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    cohortMonths.push(month);
  }

  // Get cohort sizes: users signed up each month
  const cohortSizeRows = await db
    .select({
      cohortMonth: sql<string>`TO_CHAR(${user.createdAt}, 'YYYY-MM')`,
      cohortSize: count(),
    })
    .from(user)
    .where(
      gte(user.createdAt, new Date(now.getFullYear(), now.getMonth() - months + 1, 1))
    )
    .groupBy(sql`TO_CHAR(${user.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${user.createdAt}, 'YYYY-MM')`);

  const cohortSizeMap = new Map<string, number>();
  for (const row of cohortSizeRows) {
    cohortSizeMap.set(String(row.cohortMonth), row.cohortSize);
  }

  // For each cohort month, compute retention in subsequent months
  const results: CohortRow[] = await Promise.all(
    cohortMonths.map(async (cohortMonth) => {
      const cohortSize = cohortSizeMap.get(cohortMonth) ?? 0;
      if (cohortSize === 0) {
        return { cohortMonth, cohortSize: 0, retentionPcts: [] };
      }

      const cohortStart = new Date(`${cohortMonth}-01`);
      const cohortEnd = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + 1, 1);

      // Get subsequent months after the cohort month up to now
      const subsequentMonths: string[] = [];
      const cohortIdx = cohortMonths.indexOf(cohortMonth);
      for (let i = cohortIdx + 1; i < cohortMonths.length; i++) {
        const m = cohortMonths[i];
        if (m !== undefined) subsequentMonths.push(m);
      }

      if (subsequentMonths.length === 0) {
        return { cohortMonth, cohortSize, retentionPcts: [] };
      }

      const retentionPcts = await Promise.all(
        subsequentMonths.map(async (subMonth) => {
          const subStart = new Date(`${subMonth}-01`);
          const subEnd = new Date(subStart.getFullYear(), subStart.getMonth() + 1, 1);

          const retainedRows = await db
            .select({ cnt: sql<string>`COUNT(DISTINCT ${order.buyerId})` })
            .from(order)
            .where(and(
              sql`${order.buyerId} IN (
                SELECT id FROM "user"
                WHERE created_at >= ${cohortStart.toISOString()} AND created_at < ${cohortEnd.toISOString()}
              )`,
              gte(order.createdAt, subStart),
              lt(order.createdAt, subEnd)
            ));

          const retained = Number(retainedRows[0]?.cnt ?? 0);
          return Math.round((retained / cohortSize) * 1000) / 10;
        })
      );

      return { cohortMonth, cohortSize, retentionPcts };
    })
  );

  return results;
}

export async function getSellerAnalyticsTable(
  params: SellerAnalyticsParams
): Promise<{ sellers: SellerAnalyticsRow[]; total: number }> {
  const { page, pageSize, sortBy, sortDir, bandFilter, tierFilter, search } = params;
  const safePageSize = Math.min(pageSize, 100);
  const offset = (page - 1) * safePageSize;

  const conditions = [];
  if (bandFilter) {
    conditions.push(eq(sellerProfile.performanceBand, bandFilter));
  }
  if (tierFilter) {
    conditions.push(eq(sellerProfile.storeTier, tierFilter));
  }

  const searchCondition = search
    ? or(
        ilike(sellerProfile.storeName, `%${escapeLike(search)}%`),
        ilike(user.username, `%${escapeLike(search)}%`)
      )
    : undefined;

  const whereClause = conditions.length > 0 || searchCondition
    ? and(...conditions, searchCondition)
    : undefined;

  const gmvSubquery = sql<string>`COALESCE((
    SELECT SUM(o.total_cents)
    FROM "order" o
    WHERE o.seller_id = ${sellerProfile.userId}
      AND o.status = 'COMPLETED'
  ), 0)`;

  const sortColumn = (() => {
    if (sortBy === 'gmv') return gmvSubquery;
    if (sortBy === 'orders') return sellerPerformance.totalOrders;
    if (sortBy === 'rating') return sellerPerformance.averageRating;
    if (sortBy === 'cancelRate') return sellerPerformance.cancelRate;
    if (sortBy === 'returnRate') return sellerPerformance.returnRate;
    return sellerProfile.createdAt;
  })();

  const orderByClause = sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: sellerProfile.userId,
        storeName: sellerProfile.storeName,
        storeSlug: sellerProfile.storeSlug,
        username: user.username,
        sellerType: sellerProfile.sellerType,
        storeTier: sellerProfile.storeTier,
        listerTier: sellerProfile.listerTier,
        performanceBand: sellerProfile.performanceBand,
        status: sellerProfile.status,
        totalOrders: sellerPerformance.totalOrders,
        completedOrders: sellerPerformance.completedOrders,
        cancelRate: sellerPerformance.cancelRate,
        returnRate: sellerPerformance.returnRate,
        averageRating: sellerPerformance.averageRating,
        totalReviews: sellerPerformance.totalReviews,
        lateShipmentRate: sellerPerformance.lateShipmentRate,
        gmvCents: gmvSubquery,
        createdAt: sellerProfile.createdAt,
      })
      .from(sellerProfile)
      .innerJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
      .innerJoin(user, eq(user.id, sellerProfile.userId))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(safePageSize)
      .offset(offset),
    db
      .select({ cnt: count() })
      .from(sellerProfile)
      .innerJoin(sellerPerformance, eq(sellerPerformance.sellerProfileId, sellerProfile.id))
      .innerJoin(user, eq(user.id, sellerProfile.userId))
      .where(whereClause),
  ]);

  return {
    sellers: rows.map((r) => ({
      ...r,
      gmvCents: Number(r.gmvCents),
      cancelRate: Number(r.cancelRate),
      returnRate: Number(r.returnRate),
      lateShipmentRate: Number(r.lateShipmentRate),
      averageRating: r.averageRating != null ? Number(r.averageRating) : null,
    })),
    total: totalRows[0]?.cnt ?? 0,
  };
}
