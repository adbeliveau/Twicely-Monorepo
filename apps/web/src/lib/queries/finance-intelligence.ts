/**
 * Finance Intelligence Layer query-time data fetchers.
 * Used by intelligence card components to load their data.
 * Financial Center Canonical §6.
 */

import { db } from '@twicely/db';
import {
  order,
  orderItem,
  listing,
  expense,
  financialProjection,
} from '@twicely/db/schema';
import { eq, and, gte, sql, isNotNull } from 'drizzle-orm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfCurrentYear(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

function monthsAgo(n: number): Date {
  return new Date(Date.now() - n * 30 * 24 * 60 * 60 * 1000);
}

// ─── Revenue + order count ────────────────────────────────────────────────────

/** Current calendar month gross revenue in cents. */
export async function getCurrentMonthRevenue(userId: string): Promise<number> {
  const since = startOfCurrentMonth();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${order.totalCents}), 0)::int`,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, since),
      ),
    );
  return row?.total ?? 0;
}

/** Current calendar month completed order count. */
export async function getCurrentMonthOrderCount(userId: string): Promise<number> {
  const since = startOfCurrentMonth();
  const [row] = await db
    .select({
      cnt: sql<number>`count(*)::int`,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, since),
      ),
    );
  return row?.cnt ?? 0;
}

// ─── Profit by category ───────────────────────────────────────────────────────

export interface CategoryProfitData {
  categoryId: string | null;
  revenueCents: number;
  cogsCents: number;
  soldCount: number;
}

/**
 * Profit breakdown by listing category for the trailing 90 days.
 * Only includes orders where listing has cogsCents set.
 */
export async function getProfitByCategory(userId: string): Promise<CategoryProfitData[]> {
  const since = monthsAgo(3);

  const rows = await db
    .select({
      categoryId: listing.categoryId,
      revenueCents: sql<number>`coalesce(sum(${order.totalCents}), 0)::int`,
      cogsCents: sql<number>`coalesce(sum(${listing.cogsCents}), 0)::int`,
      soldCount: sql<number>`count(distinct ${order.id})::int`,
    })
    .from(order)
    .innerJoin(orderItem, eq(orderItem.orderId, order.id))
    .innerJoin(listing, eq(listing.id, orderItem.listingId))
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, since),
        isNotNull(listing.cogsCents),
      ),
    )
    .groupBy(listing.categoryId);

  return rows.map((r) => ({
    categoryId: r.categoryId,
    revenueCents: r.revenueCents,
    cogsCents: r.cogsCents,
    soldCount: r.soldCount,
  }));
}

// ─── Expense trends ───────────────────────────────────────────────────────────

export interface MonthlyExpenseData {
  month: string;
  totalCents: number;
  topCategory: string;
}

/** Monthly expense totals for the trailing N months. */
export async function getExpenseTrends(
  userId: string,
  months = 6,
): Promise<MonthlyExpenseData[]> {
  const since = monthsAgo(months);

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${expense.expenseDate}), 'YYYY-MM')`,
      totalCents: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int`,
      topCategory: sql<string>`mode() within group (order by ${expense.category})`,
    })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        gte(expense.expenseDate, since),
      ),
    )
    .groupBy(sql`date_trunc('month', ${expense.expenseDate})`)
    .orderBy(sql`date_trunc('month', ${expense.expenseDate})`);

  return rows.map((r) => ({
    month: r.month,
    totalCents: r.totalCents,
    topCategory: r.topCategory ?? 'Other',
  }));
}

// ─── Stale listings ───────────────────────────────────────────────────────────

export interface StaleListingData {
  id: string;
  title: string | null;
  slug: string | null;
  priceCents: number | null;
  activatedAt: Date;
  daysActive: number;
}

const STALE_DAYS_THRESHOLD = 60;

/**
 * Active listings that have been unsold for >= 60 days.
 */
export async function getStaleListings(userId: string): Promise<StaleListingData[]> {
  const cutoff = new Date(Date.now() - STALE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      slug: listing.slug,
      priceCents: listing.priceCents,
      activatedAt: listing.activatedAt,
    })
    .from(listing)
    .where(
      and(
        eq(listing.ownerUserId, userId),
        eq(listing.status, 'ACTIVE'),
        isNotNull(listing.activatedAt),
      ),
    );

  return rows
    .filter((r) => r.activatedAt !== null && r.activatedAt <= cutoff)
    .map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      priceCents: r.priceCents,
      activatedAt: r.activatedAt!,
      daysActive: Math.floor(
        (Date.now() - r.activatedAt!.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }))
    .sort((a, b) => b.daysActive - a.daysActive);
}

// ─── Financial projection (nightly cache) ────────────────────────────────────

export interface FinancialProjectionData {
  projectedRevenue30dCents: number | null;
  projectedExpenses30dCents: number | null;
  projectedProfit30dCents: number | null;
  sellThroughRate90d: number | null;
  avgSalePrice90dCents: number | null;
  effectiveFeeRate90d: number | null;
  avgDaysToSell90d: number | null;
  breakEvenRevenueCents: number | null;
  breakEvenOrders: number | null;
  healthScore: number | null;
  healthScoreBreakdownJson: unknown;
  inventoryTurnsPerMonth: number | null;
  performingPeriodsJson: unknown;
  dataQualityScore: number;
  computedAt: Date;
}

/** Fetch the nightly-cached financial projection for a seller profile. */
export async function getFinancialProjection(
  sellerProfileId: string,
): Promise<FinancialProjectionData | null> {
  const [row] = await db
    .select()
    .from(financialProjection)
    .where(eq(financialProjection.sellerProfileId, sellerProfileId))
    .limit(1);

  return row ?? null;
}

// ─── YTD net profit ───────────────────────────────────────────────────────────

/** Year-to-date net profit estimate (revenue - fees - expenses). In cents. */
export async function getNetProfitYtd(userId: string): Promise<number> {
  const since = startOfCurrentYear();

  const [revenueRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${order.totalCents}), 0)::int`,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, since),
      ),
    );

  const [expenseRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int`,
    })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        gte(expense.expenseDate, since),
      ),
    );

  const revenue = revenueRow?.total ?? 0;
  const expenses = expenseRow?.total ?? 0;
  return revenue - expenses;
}
