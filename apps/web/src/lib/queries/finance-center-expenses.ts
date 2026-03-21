/**
 * Expense and COGS queries for the Financial Center.
 * Split from finance-center-detail.ts per 300-line limit.
 */
import { db } from '@twicely/db';
import { expense, order, orderItem, listing } from '@twicely/db/schema';
import {
  eq,
  and,
  gte,
  lte,
  isNotNull,
  sql,
  desc,
  asc,
  count,
} from 'drizzle-orm';
import { daysAgo } from './finance-center';
import type { ListExpensesInput } from '@/lib/validations/finance-center';

export interface ExpenseRow {
  id: string;
  category: string;
  amountCents: number;
  currency: string;
  vendor: string | null;
  description: string | null;
  receiptUrl: string | null;
  receiptDataJson: unknown;
  expenseDate: Date;
  isRecurring: boolean;
  recurringFrequency: string | null;
  recurringEndDate: Date | null;
  parentExpenseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseListResult {
  expenses: ExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseCategoryBreakdown {
  category: string;
  totalCents: number;
  count: number;
  percentOfTotal: number;
}

export interface CogsSummary {
  totalCogsCents: number;
  totalSoldRevenueCents: number;
  grossProfitCents: number;
  cogsMarginPercent: number;
  itemCount: number;
}

const EXPENSE_COLUMNS = {
  id: expense.id,
  category: expense.category,
  amountCents: expense.amountCents,
  currency: expense.currency,
  vendor: expense.vendor,
  description: expense.description,
  receiptUrl: expense.receiptUrl,
  receiptDataJson: expense.receiptDataJson,
  expenseDate: expense.expenseDate,
  isRecurring: expense.isRecurring,
  recurringFrequency: expense.recurringFrequency,
  recurringEndDate: expense.recurringEndDate,
  parentExpenseId: expense.parentExpenseId,
  createdAt: expense.createdAt,
  updatedAt: expense.updatedAt,
} as const;

function buildSortColumn(
  sortBy: ListExpensesInput['sortBy'],
  sortOrder: ListExpensesInput['sortOrder'],
) {
  const col =
    sortBy === 'amountCents'
      ? expense.amountCents
      : sortBy === 'category'
        ? expense.category
        : sortBy === 'createdAt'
          ? expense.createdAt
          : expense.expenseDate;
  return sortOrder === 'asc' ? asc(col) : desc(col);
}

export async function getExpenseList(
  userId: string,
  opts: ListExpensesInput,
): Promise<ExpenseListResult> {
  const { page, pageSize, category, startDate, endDate, sortBy, sortOrder } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(expense.userId, userId)];
  if (category) conditions.push(eq(expense.category, category));
  if (startDate) conditions.push(gte(expense.expenseDate, new Date(startDate)));
  if (endDate) conditions.push(lte(expense.expenseDate, new Date(endDate)));

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ total: count() })
    .from(expense)
    .where(where);

  const rows = await db
    .select(EXPENSE_COLUMNS)
    .from(expense)
    .where(where)
    .orderBy(buildSortColumn(sortBy, sortOrder))
    .limit(pageSize)
    .offset(offset);

  return {
    expenses: rows,
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  };
}

export async function getExpenseById(
  userId: string,
  expenseId: string,
): Promise<ExpenseRow | null> {
  const [row] = await db
    .select(EXPENSE_COLUMNS)
    .from(expense)
    .where(and(eq(expense.userId, userId), eq(expense.id, expenseId)))
    .limit(1);

  return row ?? null;
}

export async function getExpenseCategoryBreakdown(
  userId: string,
  days: number,
): Promise<ExpenseCategoryBreakdown[]> {
  const since = daysAgo(days);

  const rows = await db
    .select({
      category: expense.category,
      totalCents: sql<number>`coalesce(sum(${expense.amountCents}), 0)::int`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(expense)
    .where(and(eq(expense.userId, userId), gte(expense.expenseDate, since)))
    .groupBy(expense.category)
    .orderBy(sql`sum(${expense.amountCents}) desc`);

  const grandTotal = rows.reduce((sum, r) => sum + r.totalCents, 0);

  return rows.map((r) => ({
    category: r.category,
    totalCents: r.totalCents,
    count: r.cnt,
    percentOfTotal:
      grandTotal > 0
        ? Math.round((r.totalCents / grandTotal) * 10000) / 100
        : 0,
  }));
}

export async function getCogsSummary(
  userId: string,
  days: number,
): Promise<CogsSummary> {
  const since = daysAgo(days);

  // Join order -> orderItem -> listing where listing.cogsCents IS NOT NULL
  // Only include COMPLETED orders where the seller is the userId
  const rows = await db
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

  if (rows.length === 0) {
    return {
      totalCogsCents: 0,
      totalSoldRevenueCents: 0,
      grossProfitCents: 0,
      cogsMarginPercent: 0,
      itemCount: 0,
    };
  }

  let totalCogsCents = 0;
  let totalSoldRevenueCents = 0;
  const seenOrderIds = new Set<string>();

  for (const row of rows) {
    totalCogsCents += row.cogsCents ?? 0;
    if (!seenOrderIds.has(row.orderId)) {
      totalSoldRevenueCents += row.orderTotal;
      seenOrderIds.add(row.orderId);
    }
  }

  const grossProfitCents = totalSoldRevenueCents - totalCogsCents;
  const cogsMarginPercent =
    totalSoldRevenueCents > 0
      ? Math.round((grossProfitCents / totalSoldRevenueCents) * 10000) / 100
      : 0;

  return {
    totalCogsCents,
    totalSoldRevenueCents,
    grossProfitCents,
    cogsMarginPercent,
    itemCount: rows.length,
  };
}
