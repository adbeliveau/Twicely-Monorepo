/** Finance Center queries — types, KPIs, revenue time series. */
import { db } from '@twicely/db';
import { ledgerEntry, sellerBalance, order, orderItem, listing, sellerProfile } from '@twicely/db/schema';
import { eq, and, gte, sql, inArray, isNotNull } from 'drizzle-orm';

export interface FinanceDashboardKPIs {
  grossRevenueCents: number;
  totalOrderCount: number;
  avgSalePriceCents: number;
  tfFeesCents: number;
  stripeFeesCents: number;
  boostFeesCents: number;
  totalFeesCents: number;
  shippingCostsCents: number;
  netEarningsCents: number;
  effectiveFeeRatePercent: number;
  availableForPayoutCents: number;
  pendingCents: number;
  reservedCents: number;
  // COGS fields (D4.1)
  cogsTotalCents: number;
  cogsGrossProfitCents: number;
  cogsMarginPercent: number;
}

export interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

export interface TransactionRow {
  id: string;
  type: string;
  amountCents: number;
  status: string;
  orderId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdAt: Date;
}

export interface TransactionListResult {
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseSummaryResult {
  totalExpensesCents: number;
  expensesByCategory: Array<{ category: string; totalCents: number; count: number }>;
  recentExpenses: Array<{
    id: string;
    category: string;
    amountCents: number;
    vendor: string | null;
    description: string | null;
    expenseDate: Date;
  }>;
}

export interface MileageSummaryResult {
  totalMiles: number;
  totalDeductionCents: number;
  tripCount: number;
}

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const FEE_TYPES = [
  'ORDER_TF_FEE',
  'ORDER_BOOST_FEE',
  'ORDER_STRIPE_PROCESSING_FEE',
] as const;

export async function getFinanceDashboardKPIs(
  userId: string,
  days = 30,
): Promise<FinanceDashboardKPIs> {
  const since = daysAgo(days);

  const [revenueRow] = await db
    .select({
      gross: sql<number>`coalesce(sum(${order.totalCents}), 0)::int`,
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

  const grossRevenueCents = revenueRow?.gross ?? 0;
  const totalOrderCount = revenueRow?.cnt ?? 0;

  const feeRows = await db
    .select({
      type: ledgerEntry.type,
      total: sql<number>`coalesce(sum(abs(${ledgerEntry.amountCents})), 0)::int`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        gte(ledgerEntry.createdAt, since),
        inArray(ledgerEntry.type, [...FEE_TYPES]),
      ),
    )
    .groupBy(ledgerEntry.type);

  let tfFeesCents = 0;
  let stripeFeesCents = 0;
  let boostFeesCents = 0;
  for (const row of feeRows) {
    if (row.type === 'ORDER_TF_FEE') tfFeesCents = row.total;
    if (row.type === 'ORDER_STRIPE_PROCESSING_FEE') stripeFeesCents = row.total;
    if (row.type === 'ORDER_BOOST_FEE') boostFeesCents = row.total;
  }

  const [shippingRow] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${ledgerEntry.amountCents})), 0)::int`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        gte(ledgerEntry.createdAt, since),
        eq(ledgerEntry.type, 'SHIPPING_LABEL_PURCHASE'),
      ),
    );

  const shippingCostsCents = shippingRow?.total ?? 0;
  const totalFeesCents = tfFeesCents + stripeFeesCents + boostFeesCents;
  const netEarningsCents = grossRevenueCents - totalFeesCents - shippingCostsCents;
  const avgSalePriceCents = totalOrderCount > 0 ? Math.floor(grossRevenueCents / totalOrderCount) : 0;
  const effectiveFeeRatePercent =
    grossRevenueCents > 0
      ? Math.round((totalFeesCents / grossRevenueCents) * 10000) / 100
      : 0;

  const [balance] = await db
    .select({
      availableCents: sellerBalance.availableCents,
      pendingCents: sellerBalance.pendingCents,
      reservedCents: sellerBalance.reservedCents,
    })
    .from(sellerBalance)
    .where(eq(sellerBalance.userId, userId))
    .limit(1);

  // COGS: join completed orders -> orderItems -> listings with cogsCents
  const cogsRows = await db
    .select({
      cogsCents: listing.cogsCents,
      orderId: order.id,
      orderTotal: order.totalCents,
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
    );

  let cogsTotalCents = 0;
  let cogsSoldRevenueCents = 0;
  const seenCogsOrderIds = new Set<string>();
  for (const r of cogsRows) {
    cogsTotalCents += r.cogsCents ?? 0;
    if (!seenCogsOrderIds.has(r.orderId)) {
      cogsSoldRevenueCents += r.orderTotal;
      seenCogsOrderIds.add(r.orderId);
    }
  }
  const cogsGrossProfitCents = cogsSoldRevenueCents - cogsTotalCents;
  const cogsMarginPercent =
    cogsSoldRevenueCents > 0
      ? Math.round((cogsGrossProfitCents / cogsSoldRevenueCents) * 10000) / 100
      : 0;

  return {
    grossRevenueCents,
    totalOrderCount,
    avgSalePriceCents,
    tfFeesCents,
    stripeFeesCents,
    boostFeesCents,
    totalFeesCents,
    shippingCostsCents,
    netEarningsCents,
    effectiveFeeRatePercent,
    availableForPayoutCents: balance?.availableCents ?? 0,
    pendingCents: balance?.pendingCents ?? 0,
    reservedCents: balance?.reservedCents ?? 0,
    cogsTotalCents,
    cogsGrossProfitCents,
    cogsMarginPercent,
  };
}

export async function getRevenueTimeSeries(
  userId: string,
  days = 30,
): Promise<RevenueDataPoint[]> {
  const since = daysAgo(days);

  const rows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${order.completedAt}), 'YYYY-MM-DD')`,
      revenueCents: sql<number>`coalesce(sum(${order.totalCents}), 0)::int`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, since),
      ),
    )
    .groupBy(sql`date_trunc('day', ${order.completedAt})`)
    .orderBy(sql`date_trunc('day', ${order.completedAt})`);

  const dateMap = new Map<string, { revenueCents: number; orderCount: number }>();
  for (const row of rows) {
    dateMap.set(row.date, { revenueCents: row.revenueCents, orderCount: row.orderCount });
  }

  const result: RevenueDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const existing = dateMap.get(dateStr);
    result.push({
      date: dateStr,
      revenueCents: existing?.revenueCents ?? 0,
      orderCount: existing?.orderCount ?? 0,
    });
  }

  return result;
}

export async function getFinanceTier(userId: string): Promise<'FREE' | 'PRO'> {
  const [profile] = await db
    .select({ financeTier: sellerProfile.financeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);
  return profile?.financeTier ?? 'FREE';
}

// Re-export from split file so consumers can import from one place
export {
  getRecentTransactions,
  getExpenseSummary,
  getMileageSummary,
  getTypeGroupFilter,
} from './finance-center-detail';

// Re-export expense + COGS queries
export {
  getExpenseList,
  getExpenseById,
  getExpenseCategoryBreakdown,
  getCogsSummary,
  type ExpenseRow,
  type ExpenseListResult,
  type ExpenseCategoryBreakdown,
  type CogsSummary,
} from './finance-center-expenses';

// Re-export mileage queries
export {
  getMileageList,
  getMileageById,
  getMileagePeriodSummary,
  type MileageRow,
  type MileageListResult,
  type MileagePeriodSummary,
} from './finance-center-mileage';
