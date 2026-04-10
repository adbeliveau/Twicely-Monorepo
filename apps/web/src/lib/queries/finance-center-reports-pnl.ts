/**
 * Finance Center P&L report data query.
 * Split from finance-center-reports.ts to stay under the 300-line limit.
 */
import { db } from '@twicely/db';
import { ledgerEntry, order, orderItem, listing, expense, mileageEntry } from '@twicely/db/schema';
import {
  eq,
  and,
  gte,
  lte,
  sql,
  inArray,
  isNotNull,
} from 'drizzle-orm';

import type { PnlReportData } from './finance-center-reports-pnl-types';
export type { PnlReportData } from './finance-center-reports-pnl-types';

// ---------------------------------------------------------------------------
// Internal constant (exported for use in balance-cashflow module)
// ---------------------------------------------------------------------------

export const PLATFORM_FEE_TYPES = [
  'ORDER_TF_FEE',
  'ORDER_BOOST_FEE',
  'ORDER_STRIPE_PROCESSING_FEE',
  'INSERTION_FEE',
  'LOCAL_TRANSACTION_FEE',
  'AUTH_FEE_BUYER',
  'AUTH_FEE_SELLER',
  'SUBSCRIPTION_CHARGE',
  'FINANCE_SUBSCRIPTION_CHARGE',
  'CROSSLISTER_PLATFORM_FEE',
] as const;

// ---------------------------------------------------------------------------
// P&L Report Data
// ---------------------------------------------------------------------------

export async function getPnlReportData(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<PnlReportData> {
  const dateRange = and(
    eq(order.sellerId, userId),
    eq(order.status, 'COMPLETED'),
    gte(order.completedAt, periodStart),
    lte(order.completedAt, periodEnd),
  );

  const [revenueRow] = await db
    .select({
      gross: sql<number>`coalesce(sum(${order.totalCents}), 0)::int`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(order)
    .where(dateRange);

  const twicelyCentsFromOrders = revenueRow?.gross ?? 0;
  const totalOrderCount = revenueRow?.cnt ?? 0;

  // Off-platform (crosslister) revenue — INFORMATIONAL, does not flow through Twicely payments
  const [xRevRow] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntry.amountCents}), 0)::int` })
    .from(ledgerEntry)
    .where(and(
      eq(ledgerEntry.userId, userId),
      gte(ledgerEntry.createdAt, periodStart),
      lte(ledgerEntry.createdAt, periodEnd),
      eq(ledgerEntry.type, 'CROSSLISTER_SALE_REVENUE'),
    ));

  // Cash local sale revenue — INFORMATIONAL per §A16; $0 platform fee
  const [cashRevRow] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntry.amountCents}), 0)::int` })
    .from(ledgerEntry)
    .where(and(
      eq(ledgerEntry.userId, userId),
      gte(ledgerEntry.createdAt, periodStart),
      lte(ledgerEntry.createdAt, periodEnd),
      eq(ledgerEntry.type, 'LOCAL_CASH_SALE_REVENUE'),
    ));

  const crosslisterRevenueCents = xRevRow?.total ?? 0;
  const cashLocalRevenueCents = cashRevRow?.total ?? 0;
  const grossRevenueCents = twicelyCentsFromOrders + crosslisterRevenueCents + cashLocalRevenueCents;

  const feeRows = await db
    .select({
      type: ledgerEntry.type,
      total: sql<number>`coalesce(sum(abs(${ledgerEntry.amountCents})), 0)::int`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        gte(ledgerEntry.createdAt, periodStart),
        lte(ledgerEntry.createdAt, periodEnd),
        inArray(ledgerEntry.type, [...PLATFORM_FEE_TYPES]),
      ),
    )
    .groupBy(ledgerEntry.type);

  let tfFeesCents = 0;
  let stripeFeesCents = 0;
  let boostFeesCents = 0;
  let insertionFeesCents = 0;
  let localFeesCents = 0;
  let authFeesCents = 0;
  let subscriptionChargesCents = 0;
  let crosslisterFeesCents = 0;

  for (const row of feeRows) {
    if (row.type === 'ORDER_TF_FEE') tfFeesCents = row.total;
    else if (row.type === 'ORDER_STRIPE_PROCESSING_FEE') stripeFeesCents = row.total;
    else if (row.type === 'ORDER_BOOST_FEE') boostFeesCents = row.total;
    else if (row.type === 'INSERTION_FEE') insertionFeesCents = row.total;
    else if (row.type === 'LOCAL_TRANSACTION_FEE') localFeesCents = row.total;
    else if (row.type === 'AUTH_FEE_BUYER' || row.type === 'AUTH_FEE_SELLER') authFeesCents += row.total;
    else if (row.type === 'SUBSCRIPTION_CHARGE' || row.type === 'FINANCE_SUBSCRIPTION_CHARGE') subscriptionChargesCents += row.total;
    else if (row.type === 'CROSSLISTER_PLATFORM_FEE') crosslisterFeesCents = row.total;
  }

  const totalPlatformFeesCents = tfFeesCents + stripeFeesCents + boostFeesCents +
    insertionFeesCents + localFeesCents + authFeesCents + subscriptionChargesCents +
    crosslisterFeesCents;

  const [shippingRow] = await db
    .select({ total: sql<number>`coalesce(sum(abs(${ledgerEntry.amountCents})), 0)::int` })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        gte(ledgerEntry.createdAt, periodStart),
        lte(ledgerEntry.createdAt, periodEnd),
        eq(ledgerEntry.type, 'SHIPPING_LABEL_PURCHASE'),
      ),
    );

  const shippingCostsCents = shippingRow?.total ?? 0;

  const cogsRows = await db
    .select({
      cogsCents: listing.cogsCents,
      orderId: order.id,
    })
    .from(order)
    .innerJoin(orderItem, eq(orderItem.orderId, order.id))
    .innerJoin(listing, eq(listing.id, orderItem.listingId))
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, periodStart),
        lte(order.completedAt, periodEnd),
        isNotNull(listing.cogsCents),
      ),
    );

  let cogsTotalCents = 0;
  for (const r of cogsRows) {
    cogsTotalCents += r.cogsCents ?? 0;
  }

  const [expTotalRow] = await db
    .select({ total: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int` })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        gte(expense.expenseDate, periodStart),
        lte(expense.expenseDate, periodEnd),
      ),
    );

  const operatingExpensesCents = expTotalRow?.total ?? 0;

  const expCatRows = await db
    .select({
      category: expense.category,
      totalCents: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        gte(expense.expenseDate, periodStart),
        lte(expense.expenseDate, periodEnd),
      ),
    )
    .groupBy(expense.category)
    .orderBy(sql`sum(${expense.amountCents}) desc`);

  const expensesByCategory = expCatRows.map((r) => ({
    category: r.category,
    totalCents: r.totalCents,
    count: r.cnt,
  }));

  const [mileRow] = await db
    .select({
      totalDeductionCents: sql<number>`coalesce(sum(${mileageEntry.deductionCents}), 0)::int`,
      totalMiles: sql<number>`coalesce(sum(${mileageEntry.miles}), 0)`,
      tripCount: sql<number>`count(*)::int`,
    })
    .from(mileageEntry)
    .where(
      and(
        eq(mileageEntry.userId, userId),
        gte(mileageEntry.tripDate, periodStart),
        lte(mileageEntry.tripDate, periodEnd),
      ),
    );

  const mileageDeductionCents = mileRow?.totalDeductionCents ?? 0;
  const totalMiles = mileRow?.totalMiles ?? 0;
  const tripCount = mileRow?.tripCount ?? 0;

  const grossProfitCents = grossRevenueCents - cogsTotalCents;
  const netAfterFeesCents = grossProfitCents - totalPlatformFeesCents - shippingCostsCents;
  const netProfitCents = netAfterFeesCents - operatingExpensesCents - mileageDeductionCents;
  const avgSalePriceCents = totalOrderCount > 0 ? Math.floor(grossRevenueCents / totalOrderCount) : 0;
  const effectiveFeeRatePercent = grossRevenueCents > 0
    ? Math.round((totalPlatformFeesCents / grossRevenueCents) * 10000) / 100
    : 0;
  const cogsMarginPercent = grossRevenueCents > 0
    ? Math.round((grossProfitCents / grossRevenueCents) * 10000) / 100
    : 0;

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    grossRevenueCents,
    totalOrderCount,
    cogsTotalCents,
    grossProfitCents,
    tfFeesCents,
    stripeFeesCents,
    boostFeesCents,
    insertionFeesCents,
    localFeesCents,
    authFeesCents,
    subscriptionChargesCents,
    crosslisterFeesCents,
    totalPlatformFeesCents,
    crosslisterRevenueCents,
    cashLocalRevenueCents,
    shippingCostsCents,
    netAfterFeesCents,
    operatingExpensesCents,
    expensesByCategory,
    mileageDeductionCents,
    totalMiles,
    tripCount,
    netProfitCents,
    avgSalePriceCents,
    effectiveFeeRatePercent,
    cogsMarginPercent,
  };
}
