/**
 * Admin Analytics Queries (I10)
 * GMV trends, take rate, user growth, cohort retention, seller performance table.
 */

import { db } from '@twicely/db';
import { order, user, listing, ledgerEntry } from '@twicely/db/schema';
import { sql, gte, lt, and, eq, count } from 'drizzle-orm';

export interface AnalyticsSummary {
  gmvCents: number;
  gmvPreviousCents: number;
  orderCount: number;
  orderCountPrevious: number;
  averageOrderCents: number;
  newUserCount: number;
  newUserCountPrevious: number;
  newSellerCount: number;
  activeListingCount: number;
  totalFeeRevenueCents: number;
  takeRateBps: number;
}

export interface TimeSeriesPoint {
  date: string;  // YYYY-MM-DD
  value: number; // cents for gmv/fees, raw count for orders/users
}

const PLATFORM_FEE_TYPES = [
  'ORDER_TF_FEE',
  'ORDER_BOOST_FEE',
  'INSERTION_FEE',
  'SUBSCRIPTION_CHARGE',
  'LOCAL_TRANSACTION_FEE',
  'CROSSLISTER_PLATFORM_FEE',
] as const;

function getPeriodStart(periodDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - periodDays);
  return d;
}

function getPreviousPeriodStart(periodDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - periodDays * 2);
  return d;
}

export async function getAnalyticsSummary(periodDays: number): Promise<AnalyticsSummary> {
  const periodStart = getPeriodStart(periodDays);
  const prevStart = getPreviousPeriodStart(periodDays);
  const prevEnd = getPeriodStart(periodDays);

  const feeTypesCondition = sql`${ledgerEntry.type} IN (${sql.join(
    PLATFORM_FEE_TYPES.map((t) => sql`${t}`),
    sql`, `
  )})`;

  const [
    gmvResult,
    gmvPrevResult,
    orderResult,
    orderPrevResult,
    newUserResult,
    newUserPrevResult,
    newSellerResult,
    activeListingResult,
    feeRevenueResult,
  ] = await Promise.all([
    db.select({ total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)` })
      .from(order)
      .where(and(
        sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
        gte(order.createdAt, periodStart)
      )),
    db.select({ total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)` })
      .from(order)
      .where(and(
        sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
        gte(order.createdAt, prevStart),
        lt(order.createdAt, prevEnd)
      )),
    db.select({ cnt: sql<string>`COUNT(*)` })
      .from(order)
      .where(and(
        sql`${order.status} != 'CANCELED'`,
        gte(order.createdAt, periodStart)
      )),
    db.select({ cnt: sql<string>`COUNT(*)` })
      .from(order)
      .where(and(
        sql`${order.status} != 'CANCELED'`,
        gte(order.createdAt, prevStart),
        lt(order.createdAt, prevEnd)
      )),
    db.select({ cnt: sql<string>`COUNT(*)` })
      .from(user)
      .where(gte(user.createdAt, periodStart)),
    db.select({ cnt: sql<string>`COUNT(*)` })
      .from(user)
      .where(and(
        gte(user.createdAt, prevStart),
        lt(user.createdAt, prevEnd)
      )),
    db.select({ cnt: sql<string>`COUNT(*)` })
      .from(user)
      .where(and(
        eq(user.isSeller, true),
        gte(user.createdAt, periodStart)
      )),
    db.select({ cnt: sql<string>`COUNT(*)` })
      .from(listing)
      .where(eq(listing.status, 'ACTIVE')),
    db.select({ total: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)` })
      .from(ledgerEntry)
      .where(and(
        feeTypesCondition,
        eq(ledgerEntry.status, 'POSTED'),
        gte(ledgerEntry.createdAt, periodStart)
      )),
  ]);

  const gmvCents = Number(gmvResult[0]?.total ?? 0);
  const gmvPreviousCents = Number(gmvPrevResult[0]?.total ?? 0);
  const orderCount = Number(orderResult[0]?.cnt ?? 0);
  const orderCountPrevious = Number(orderPrevResult[0]?.cnt ?? 0);
  const newUserCount = Number(newUserResult[0]?.cnt ?? 0);
  const newUserCountPrevious = Number(newUserPrevResult[0]?.cnt ?? 0);
  const newSellerCount = Number(newSellerResult[0]?.cnt ?? 0);
  const activeListingCount = Number(activeListingResult[0]?.cnt ?? 0);
  const totalFeeRevenueCents = Number(feeRevenueResult[0]?.total ?? 0);
  const averageOrderCents = orderCount > 0 ? Math.round(gmvCents / orderCount) : 0;
  const takeRateBps = gmvCents > 0
    ? Math.round((totalFeeRevenueCents / gmvCents) * 10000)
    : 0;

  return {
    gmvCents,
    gmvPreviousCents,
    orderCount,
    orderCountPrevious,
    averageOrderCents,
    newUserCount,
    newUserCountPrevious,
    newSellerCount,
    activeListingCount,
    totalFeeRevenueCents,
    takeRateBps,
  };
}

export async function getAnalyticsTimeSeries(
  metric: 'gmv' | 'orders' | 'users' | 'fees',
  periodDays: number
): Promise<TimeSeriesPoint[]> {
  const periodStart = getPeriodStart(periodDays);

  if (metric === 'gmv') {
    const rows = await db
      .select({
        date: sql<string>`DATE(${order.createdAt})`,
        value: sql<string>`COALESCE(SUM(${order.totalCents}), 0)`,
      })
      .from(order)
      .where(and(
        sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
        gte(order.createdAt, periodStart)
      ))
      .groupBy(sql`DATE(${order.createdAt})`)
      .orderBy(sql`DATE(${order.createdAt})`);
    return rows.map((r) => ({ date: String(r.date), value: Number(r.value) }));
  }

  if (metric === 'orders') {
    const rows = await db
      .select({
        date: sql<string>`DATE(${order.createdAt})`,
        value: count(),
      })
      .from(order)
      .where(gte(order.createdAt, periodStart))
      .groupBy(sql`DATE(${order.createdAt})`)
      .orderBy(sql`DATE(${order.createdAt})`);
    return rows.map((r) => ({ date: String(r.date), value: r.value }));
  }

  if (metric === 'users') {
    const rows = await db
      .select({
        date: sql<string>`DATE(${user.createdAt})`,
        value: count(),
      })
      .from(user)
      .where(gte(user.createdAt, periodStart))
      .groupBy(sql`DATE(${user.createdAt})`)
      .orderBy(sql`DATE(${user.createdAt})`);
    return rows.map((r) => ({ date: String(r.date), value: r.value }));
  }

  // metric === 'fees'
  const feeTypesCondition = sql`${ledgerEntry.type} IN (${sql.join(
    PLATFORM_FEE_TYPES.map((t) => sql`${t}`),
    sql`, `
  )})`;
  const rows = await db
    .select({
      date: sql<string>`DATE(${ledgerEntry.createdAt})`,
      value: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)`,
    })
    .from(ledgerEntry)
    .where(and(
      feeTypesCondition,
      eq(ledgerEntry.status, 'POSTED'),
      gte(ledgerEntry.createdAt, periodStart)
    ))
    .groupBy(sql`DATE(${ledgerEntry.createdAt})`)
    .orderBy(sql`DATE(${ledgerEntry.createdAt})`);
  return rows.map((r) => ({ date: String(r.date), value: Number(r.value) }));
}

// ─── Re-exports from admin-analytics-sellers.ts (split) ───────────────────
export {
  getUserCohortRetention,
  getSellerAnalyticsTable,
  type CohortRow,
  type SellerAnalyticsParams,
  type SellerAnalyticsRow,
} from './admin-analytics-sellers';
