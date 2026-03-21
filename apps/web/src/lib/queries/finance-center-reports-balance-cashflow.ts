/**
 * Finance Center balance sheet and cash flow report queries.
 * Split from finance-center-reports.ts to stay under the 300-line limit.
 */
import { db } from '@twicely/db';
import {
  ledgerEntry,
  sellerBalance,
  listing,
  expense,
  mileageEntry,
} from '@twicely/db/schema';
import {
  eq,
  and,
  gte,
  lte,
  sql,
  inArray,
} from 'drizzle-orm';
import { getPnlReportData, PLATFORM_FEE_TYPES } from './finance-center-reports-pnl';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface BalanceSheetData {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  assets: {
    availableForPayoutCents: number;
    pendingCents: number;
    inventoryValueCents: number;
    inventoryCount: number;
    totalCurrentAssetsCents: number;
  };

  liabilities: {
    reservedCents: number;
    pendingRefundsCents: number;
    totalLiabilitiesCents: number;
  };

  equity: {
    netEquityCents: number;
    periodNetProfitCents: number;
    totalEquityCents: number;
  };
}

export interface CashFlowData {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  operating: {
    salesReceivedCents: number;
    refundsIssuedCents: number;
    platformFeesPaidCents: number;
    shippingCostsCents: number;
    operatingExpensesCents: number;
    mileageDeductionCents: number;
    netOperatingCents: number;
  };

  financing: {
    payoutsSentCents: number;
    payoutsFailedReversedCents: number;
    netFinancingCents: number;
  };

  netCashChangeCents: number;
  beginningBalanceCents: number;
  endingBalanceCents: number;
}

// ---------------------------------------------------------------------------
// Balance Sheet Data
// ---------------------------------------------------------------------------

export async function getBalanceSheetData(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<BalanceSheetData> {
  const [balance] = await db
    .select({
      availableCents: sellerBalance.availableCents,
      pendingCents: sellerBalance.pendingCents,
      reservedCents: sellerBalance.reservedCents,
    })
    .from(sellerBalance)
    .where(eq(sellerBalance.userId, userId))
    .limit(1);

  const availableForPayoutCents = balance?.availableCents ?? 0;
  const pendingCents = balance?.pendingCents ?? 0;
  const reservedCents = balance?.reservedCents ?? 0;

  const [invRow] = await db
    .select({
      inventoryValueCents: sql<number>`coalesce(sum(${listing.priceCents}), 0)::int`,
      inventoryCount: sql<number>`count(*)::int`,
    })
    .from(listing)
    .where(
      and(
        eq(listing.ownerUserId, userId),
        eq(listing.status, 'ACTIVE'),
      ),
    );

  const inventoryValueCents = invRow?.inventoryValueCents ?? 0;
  const inventoryCount = invRow?.inventoryCount ?? 0;

  const REFUND_TYPES_FOR_PENDING = ['REFUND_FULL', 'REFUND_PARTIAL'] as const;

  const [pendingRefundRow] = await db
    .select({
      total: sql<number>`coalesce(sum(abs(${ledgerEntry.amountCents})), 0)::int`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, userId),
        inArray(ledgerEntry.type, [...REFUND_TYPES_FOR_PENDING]),
        eq(ledgerEntry.status, 'PENDING'),
      ),
    );

  const pendingRefundsCents = pendingRefundRow?.total ?? 0;

  const totalCurrentAssetsCents = availableForPayoutCents + pendingCents + inventoryValueCents;
  const totalLiabilitiesCents = reservedCents + pendingRefundsCents;
  const netEquityCents = totalCurrentAssetsCents - totalLiabilitiesCents;

  const pnl = await getPnlReportData(userId, periodStart, periodEnd);
  const periodNetProfitCents = pnl.netProfitCents;
  const totalEquityCents = netEquityCents;

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    assets: {
      availableForPayoutCents,
      pendingCents,
      inventoryValueCents,
      inventoryCount,
      totalCurrentAssetsCents,
    },
    liabilities: {
      reservedCents,
      pendingRefundsCents,
      totalLiabilitiesCents,
    },
    equity: {
      netEquityCents,
      periodNetProfitCents,
      totalEquityCents,
    },
  };
}

// ---------------------------------------------------------------------------
// Cash Flow Data
// ---------------------------------------------------------------------------

export async function getCashFlowData(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CashFlowData> {
  const ledgerConditions = and(
    eq(ledgerEntry.userId, userId),
    gte(ledgerEntry.createdAt, periodStart),
    lte(ledgerEntry.createdAt, periodEnd),
  );

  const ledgerRows = await db
    .select({
      type: ledgerEntry.type,
      total: sql<number>`coalesce(sum(${ledgerEntry.amountCents}), 0)::int`,
    })
    .from(ledgerEntry)
    .where(ledgerConditions)
    .groupBy(ledgerEntry.type);

  let salesReceivedCents = 0;
  let refundsIssuedCents = 0;
  let platformFeesPaidCents = 0;
  let shippingCostsCents = 0;
  let payoutsSentCents = 0;
  let payoutsFailedReversedCents = 0;

  const REFUND_TYPES = new Set(['REFUND_FULL', 'REFUND_PARTIAL']);
  const PAYOUT_INFLOW_TYPES = new Set(['PAYOUT_FAILED', 'PAYOUT_REVERSED']);

  for (const row of ledgerRows) {
    if (row.type === 'ORDER_PAYMENT_CAPTURED') {
      salesReceivedCents = Math.abs(row.total);
    } else if (REFUND_TYPES.has(row.type)) {
      refundsIssuedCents += Math.abs(row.total);
    } else if ((PLATFORM_FEE_TYPES as readonly string[]).includes(row.type)) {
      platformFeesPaidCents += Math.abs(row.total);
    } else if (row.type === 'SHIPPING_LABEL_PURCHASE') {
      shippingCostsCents += Math.abs(row.total);
    } else if (row.type === 'PAYOUT_SENT') {
      payoutsSentCents = Math.abs(row.total);
    } else if (PAYOUT_INFLOW_TYPES.has(row.type)) {
      payoutsFailedReversedCents += Math.abs(row.total);
    }
  }

  const [expRow] = await db
    .select({ total: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int` })
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        gte(expense.expenseDate, periodStart),
        lte(expense.expenseDate, periodEnd),
      ),
    );

  const operatingExpensesCents = expRow?.total ?? 0;

  const [mileRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mileageEntry.deductionCents}), 0)::int` })
    .from(mileageEntry)
    .where(
      and(
        eq(mileageEntry.userId, userId),
        gte(mileageEntry.tripDate, periodStart),
        lte(mileageEntry.tripDate, periodEnd),
      ),
    );

  const mileageDeductionCents = mileRow?.total ?? 0;

  const netOperatingCents = salesReceivedCents - refundsIssuedCents - platformFeesPaidCents -
    shippingCostsCents - operatingExpensesCents - mileageDeductionCents;

  const netFinancingCents = payoutsFailedReversedCents - payoutsSentCents;

  const netCashChangeCents = netOperatingCents + netFinancingCents;

  const [balanceRow] = await db
    .select({
      availableCents: sellerBalance.availableCents,
      pendingCents: sellerBalance.pendingCents,
    })
    .from(sellerBalance)
    .where(eq(sellerBalance.userId, userId))
    .limit(1);

  const endingBalanceCents = (balanceRow?.availableCents ?? 0) + (balanceRow?.pendingCents ?? 0);
  const beginningBalanceCents = endingBalanceCents - netCashChangeCents;

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    operating: {
      salesReceivedCents,
      refundsIssuedCents,
      platformFeesPaidCents,
      shippingCostsCents,
      operatingExpensesCents,
      mileageDeductionCents,
      netOperatingCents,
    },
    financing: {
      payoutsSentCents,
      payoutsFailedReversedCents,
      netFinancingCents,
    },
    netCashChangeCents,
    beginningBalanceCents,
    endingBalanceCents,
  };
}
