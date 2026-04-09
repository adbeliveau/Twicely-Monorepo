'use server';

import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { z } from 'zod';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import {
  getFinanceDashboardKPIs,
  getRevenueTimeSeries,
  getExpenseSummary,
  getMileageSummary,
  getFinanceTier,
  getRecentTransactions,
  getCogsSummary,
  type FinanceDashboardKPIs,
  type RevenueDataPoint,
  type ExpenseSummaryResult,
  type MileageSummaryResult,
  type TransactionListResult,
  type CogsSummary,
} from '@/lib/queries/finance-center';
import { transactionHistorySchema, cogsSummarySchema } from '@/lib/validations/finance-center';

type ActionResult = { success: true } | { success: false; error: string };

const setFinanceGoalSchema = z
  .object({
    revenueGoalCents: z.number().int().positive().optional(),
    profitGoalCents: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (data) => data.revenueGoalCents !== undefined || data.profitGoalCents !== undefined,
    { message: 'At least one goal (revenue or profit) is required' },
  );

/**
 * Set revenue and/or profit goals on the seller profile.
 * Financial Center Canonical §6.1 — goal tracker.
 */
export async function setFinanceGoalAction(data: unknown): Promise<ActionResult> {
  const { ability, session } = await authorize();

  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = setFinanceGoalSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const goals: { revenueGoalCents?: number; profitGoalCents?: number } = {};
    if (parsed.data.revenueGoalCents !== undefined) {
      goals.revenueGoalCents = parsed.data.revenueGoalCents;
    }
    if (parsed.data.profitGoalCents !== undefined) {
      goals.profitGoalCents = parsed.data.profitGoalCents;
    }

    await db
      .update(sellerProfile)
      .set({ financeGoals: goals, updatedAt: new Date() })
      .where(eq(sellerProfile.userId, userId));

    return { success: true };
  } catch (error) {
    logger.error('[setFinanceGoalAction] Failed to update finance goals', { error: String(error) });
    return { success: false, error: 'Failed to save finance goals' };
  }
}

export type FinanceDashboardResponse =
  | {
      success: true;
      kpis: FinanceDashboardKPIs;
      timeSeries: RevenueDataPoint[];
      expenses: ExpenseSummaryResult;
      mileage: MileageSummaryResult;
      financeTier: 'FREE' | 'PRO';
    }
  | { success: false; error: string };

export type TransactionHistoryResponse =
  | { success: true; data: TransactionListResult }
  | { success: false; error: string };

export type CogsSummaryResponse =
  | { success: true; cogs: CogsSummary }
  | { success: false; error: string };

/**
 * Get the full financial center dashboard data for the current seller.
 */
export async function getFinanceDashboardAction(): Promise<FinanceDashboardResponse> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('Analytics', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const [kpis, timeSeries, expenses, mileage, financeTier] = await Promise.all([
      getFinanceDashboardKPIs(userId),
      getRevenueTimeSeries(userId),
      getExpenseSummary(userId),
      getMileageSummary(userId),
      getFinanceTier(userId),
    ]);

    return { success: true, kpis, timeSeries, expenses, mileage, financeTier };
  } catch (error) {
    logger.error('[getFinanceDashboardAction] Failed to load financial data', { error: String(error) });
    return { success: false, error: 'Failed to load financial data' };
  }
}

/**
 * Get paginated transaction history for the current seller.
 */
export async function getTransactionHistoryAction(
  page?: number,
  pageSize?: number,
  type?: string,
  typeGroup?: string,
): Promise<TransactionHistoryResponse> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('LedgerEntry', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = transactionHistorySchema.safeParse({ page, pageSize, type, typeGroup });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    const { page: pg, pageSize: ps, type: t, typeGroup: tg } = parsed.data;

    const data = await getRecentTransactions(userId, {
      page: pg,
      pageSize: ps,
      type: t,
      typeGroup: tg,
    });

    return { success: true, data };
  } catch (error) {
    logger.error('[getTransactionHistoryAction] Failed to load transactions', { error: String(error) });
    return { success: false, error: 'Failed to load transactions' };
  }
}

/**
 * Get COGS summary for the current seller.
 */
export async function getCogsSummaryAction(
  input?: unknown,
): Promise<CogsSummaryResponse> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('Analytics', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = cogsSummarySchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    const cogs = await getCogsSummary(userId, parsed.data.days);
    return { success: true, cogs };
  } catch (error) {
    logger.error('[getCogsSummaryAction] Failed to load COGS data', { error: String(error) });
    return { success: false, error: 'Failed to load COGS data' };
  }
}
