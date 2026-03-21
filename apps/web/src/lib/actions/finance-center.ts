'use server';

import { authorize, sub } from '@twicely/casl';
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
  } catch {
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
  const parsed = transactionHistorySchema.safeParse({ page, pageSize, type, typeGroup });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('LedgerEntry', { userId }))) {
    return { success: false, error: 'Forbidden' };
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
  } catch {
    return { success: false, error: 'Failed to load transactions' };
  }
}

/**
 * Get COGS summary for the current seller.
 */
export async function getCogsSummaryAction(
  input?: unknown,
): Promise<CogsSummaryResponse> {
  const parsed = cogsSummarySchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('Analytics', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const cogs = await getCogsSummary(userId, parsed.data.days);
    return { success: true, cogs };
  } catch {
    return { success: false, error: 'Failed to load COGS data' };
  }
}
