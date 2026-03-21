/**
 * Local Dashboard Stats Queries (G2.7)
 * Aggregate stats for local transactions — used on hub dashboard
 */

import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { count, and, gte, lt, inArray } from 'drizzle-orm';

export interface LocalDashboardStats {
  scheduledToday: number;
  completedToday: number;
  noShowsToday: number;
}

export async function getLocalDashboardStats(): Promise<LocalDashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [scheduledResult] = await db
    .select({ count: count() })
    .from(localTransaction)
    .where(
      and(
        gte(localTransaction.scheduledAt, todayStart),
        lt(localTransaction.scheduledAt, todayEnd),
        inArray(localTransaction.status, [
          'SCHEDULED',
          'SELLER_CHECKED_IN',
          'BUYER_CHECKED_IN',
          'BOTH_CHECKED_IN',
        ]),
      ),
    );

  const [completedResult] = await db
    .select({ count: count() })
    .from(localTransaction)
    .where(
      and(
        gte(localTransaction.confirmedAt, todayStart),
        lt(localTransaction.confirmedAt, todayEnd),
        inArray(localTransaction.status, ['COMPLETED', 'RECEIPT_CONFIRMED']),
      ),
    );

  const [noShowResult] = await db
    .select({ count: count() })
    .from(localTransaction)
    .where(
      and(
        gte(localTransaction.noShowFeeChargedAt, todayStart),
        lt(localTransaction.noShowFeeChargedAt, todayEnd),
      ),
    );

  return {
    scheduledToday: scheduledResult?.count ?? 0,
    completedToday: completedResult?.count ?? 0,
    noShowsToday: noShowResult?.count ?? 0,
  };
}
