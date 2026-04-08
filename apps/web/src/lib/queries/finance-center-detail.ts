/**
 * Finance Center detail queries — transactions, expenses, mileage, type group filtering.
 */
import { db } from '@twicely/db';
import { ledgerEntry, expense, mileageEntry } from '@twicely/db/schema';
import { eq, and, gte, sql, inArray, desc, count } from 'drizzle-orm';
import { getLedgerTypeGroup } from '@twicely/finance/format';
import { daysAgo } from './finance-center';
import type { TransactionRow, TransactionListResult, ExpenseSummaryResult, MileageSummaryResult } from './finance-center';

export async function getTypeGroupFilter(typeGroup?: string): Promise<string[] | undefined> {
  if (!typeGroup || typeGroup === 'ALL') return undefined;

  const allTypes = [
    'ORDER_PAYMENT_CAPTURED', 'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE',
    'INSERTION_FEE', 'SUBSCRIPTION_CHARGE', 'FINANCE_SUBSCRIPTION_CHARGE',
    'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED',
    'REFUND_FULL', 'REFUND_PARTIAL', 'REFUND_TF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL',
    'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND', 'MANUAL_CREDIT', 'MANUAL_DEBIT',
    'RESERVE_HOLD', 'RESERVE_RELEASE', 'LOCAL_TRANSACTION_FEE', 'AUTH_FEE_BUYER', 'AUTH_FEE_SELLER',
    'AUTH_FEE_REFUND', 'CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE',
    'OVERAGE_CHARGE', 'AFFILIATE_COMMISSION_PAYOUT', 'PLATFORM_ABSORBED_COST',
    'SELLER_ADJUSTMENT', 'SUBSCRIPTION_CREDIT', 'BUYER_REFERRAL_CREDIT_ISSUED', 'BUYER_REFERRAL_CREDIT_REDEEMED',
    'CROSSLISTER_SALE_REVENUE', 'LOCAL_CASH_SALE_REVENUE',
  ];

  return allTypes.filter((t) => getLedgerTypeGroup(t) === typeGroup);
}

export async function getRecentTransactions(
  userId: string,
  opts: { page: number; pageSize: number; type?: string; typeGroup?: string },
): Promise<TransactionListResult> {
  const { page, pageSize, type, typeGroup } = opts;
  const offset = (page - 1) * pageSize;

  let typeList: string[] | undefined;
  if (!type && typeGroup && typeGroup !== 'ALL') {
    typeList = await getTypeGroupFilter(typeGroup);
  }

  const userCondition = eq(ledgerEntry.userId, userId);
  let whereConditions;
  if (type) {
    whereConditions = and(userCondition, eq(ledgerEntry.type, type as 'ORDER_TF_FEE'));
  } else if (typeList && typeList.length > 0) {
    whereConditions = and(userCondition, inArray(ledgerEntry.type, typeList as ['ORDER_TF_FEE']));
  } else {
    whereConditions = userCondition;
  }

  const [totalRow] = await db
    .select({ total: count() })
    .from(ledgerEntry)
    .where(whereConditions);

  const rows = await db
    .select({
      id: ledgerEntry.id,
      type: ledgerEntry.type,
      amountCents: ledgerEntry.amountCents,
      status: ledgerEntry.status,
      orderId: ledgerEntry.orderId,
      memo: ledgerEntry.memo,
      postedAt: ledgerEntry.postedAt,
      createdAt: ledgerEntry.createdAt,
    })
    .from(ledgerEntry)
    .where(whereConditions)
    .orderBy(desc(ledgerEntry.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    transactions: rows.map((r): TransactionRow => ({
      id: r.id,
      type: r.type,
      amountCents: r.amountCents,
      status: r.status,
      orderId: r.orderId,
      memo: r.memo,
      postedAt: r.postedAt,
      createdAt: r.createdAt,
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getExpenseSummary(
  userId: string,
  days = 30,
): Promise<ExpenseSummaryResult> {
  const since = daysAgo(days);

  const [totalRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int`,
    })
    .from(expense)
    .where(and(eq(expense.userId, userId), gte(expense.expenseDate, since)));

  const categoryRows = await db
    .select({
      category: expense.category,
      totalCents: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(expense)
    .where(and(eq(expense.userId, userId), gte(expense.expenseDate, since)))
    .groupBy(expense.category)
    .orderBy(sql`sum(${expense.amountCents}) desc`);

  const recentRows = await db
    .select({
      id: expense.id,
      category: expense.category,
      amountCents: expense.amountCents,
      vendor: expense.vendor,
      description: expense.description,
      expenseDate: expense.expenseDate,
    })
    .from(expense)
    .where(and(eq(expense.userId, userId), gte(expense.expenseDate, since)))
    .orderBy(desc(expense.expenseDate))
    .limit(5);

  return {
    totalExpensesCents: totalRow?.total ?? 0,
    expensesByCategory: categoryRows.map((r) => ({
      category: r.category,
      totalCents: r.totalCents,
      count: r.cnt,
    })),
    recentExpenses: recentRows,
  };
}

export async function getMileageSummary(
  userId: string,
  days = 30,
): Promise<MileageSummaryResult> {
  const since = daysAgo(days);

  const [row] = await db
    .select({
      totalMiles: sql<number>`coalesce(sum(${mileageEntry.miles}), 0)`,
      totalDeductionCents: sql<number>`coalesce(sum(${mileageEntry.deductionCents}), 0)::int`,
      tripCount: sql<number>`count(*)::int`,
    })
    .from(mileageEntry)
    .where(and(eq(mileageEntry.userId, userId), gte(mileageEntry.tripDate, since)));

  return {
    totalMiles: row?.totalMiles ?? 0,
    totalDeductionCents: row?.totalDeductionCents ?? 0,
    tripCount: row?.tripCount ?? 0,
  };
}
