'use server';

import { db } from '@twicely/db';
import { localTransaction, localReliabilityEvent, user, order, orderItem, safeMeetupLocation } from '@twicely/db/schema';
import { eq, and, gte, inArray, desc, count } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LocalDashboardData {
  activeCount: number;
  completed30dCount: number;
  allTimeCount: number;
  completionRate: number;
  reliabilityMarks: number;
  reliabilityTier: 'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE';
  suspendedUntil: Date | null;
}

export interface LocalTransactionListItem {
  id: string;
  orderId: string;
  status: string;
  scheduledAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
  buyerName: string | null;
  listingTitle: string | null;
  amountCents: number;
  locationName: string | null;
}

export interface ReliabilityEventRow {
  id: string;
  eventType: string;
  marksApplied: number;
  decaysAt: Date;
  createdAt: Date;
}

// ─── Status Groups ───────────────────────────────────────────────────────────

const ACTIVE_STATUSES = [
  'SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN',
  'BOTH_CHECKED_IN', 'ADJUSTMENT_PENDING', 'RESCHEDULE_PENDING',
] as const;

const COMPLETED_STATUSES = ['COMPLETED', 'RECEIPT_CONFIRMED'] as const;

// ─── Dashboard Aggregate ─────────────────────────────────────────────────────

export async function getSellerLocalDashboardData(
  sellerId: string,
): Promise<LocalDashboardData> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [userRow] = await db
    .select({
      localReliabilityMarks: user.localReliabilityMarks,
      localTransactionCount: user.localTransactionCount,
      localCompletionRate: user.localCompletionRate,
      localSuspendedUntil: user.localSuspendedUntil,
    })
    .from(user)
    .where(eq(user.id, sellerId))
    .limit(1);

  const marks = userRow?.localReliabilityMarks ?? 0;
  let tier: 'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE' = 'RELIABLE';
  if (marks >= 9) tier = 'UNRELIABLE';
  else if (marks >= 3) tier = 'INCONSISTENT';

  const [activeResult] = await db
    .select({ count: count() })
    .from(localTransaction)
    .where(and(
      eq(localTransaction.sellerId, sellerId),
      inArray(localTransaction.status, [...ACTIVE_STATUSES]),
    ));

  const [completed30dResult] = await db
    .select({ count: count() })
    .from(localTransaction)
    .where(and(
      eq(localTransaction.sellerId, sellerId),
      inArray(localTransaction.status, [...COMPLETED_STATUSES]),
      gte(localTransaction.confirmedAt, thirtyDaysAgo),
    ));

  return {
    activeCount: activeResult?.count ?? 0,
    completed30dCount: completed30dResult?.count ?? 0,
    allTimeCount: userRow?.localTransactionCount ?? 0,
    completionRate: userRow?.localCompletionRate ?? 0,
    reliabilityMarks: marks,
    reliabilityTier: tier,
    suspendedUntil: userRow?.localSuspendedUntil ?? null,
  };
}

// ─── Transaction List ────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'completed' | 'canceled' | 'no_show';

export async function getSellerLocalTransactions(
  sellerId: string,
  filter: StatusFilter = 'all',
  limit = 50,
): Promise<LocalTransactionListItem[]> {
  const statusConditions: Record<StatusFilter, ReturnType<typeof inArray> | undefined> = {
    all: undefined,
    active: inArray(localTransaction.status, [...ACTIVE_STATUSES]),
    completed: inArray(localTransaction.status, [...COMPLETED_STATUSES]),
    canceled: inArray(localTransaction.status, ['CANCELED']),
    no_show: inArray(localTransaction.status, ['NO_SHOW']),
  };

  const conditions = [eq(localTransaction.sellerId, sellerId)];
  const statusCond = statusConditions[filter];
  if (statusCond) conditions.push(statusCond);

  const rows = await db
    .select({
      id: localTransaction.id,
      orderId: localTransaction.orderId,
      status: localTransaction.status,
      scheduledAt: localTransaction.scheduledAt,
      confirmedAt: localTransaction.confirmedAt,
      createdAt: localTransaction.createdAt,
      buyerName: user.name,
      listingTitle: orderItem.title,
      amountCents: order.totalCents,
      locationName: safeMeetupLocation.name,
    })
    .from(localTransaction)
    .leftJoin(user, eq(localTransaction.buyerId, user.id))
    .leftJoin(order, eq(localTransaction.orderId, order.id))
    .leftJoin(orderItem, eq(orderItem.orderId, order.id))
    .leftJoin(safeMeetupLocation, eq(localTransaction.meetupLocationId, safeMeetupLocation.id))
    .where(and(...conditions))
    .orderBy(desc(localTransaction.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    status: r.status,
    scheduledAt: r.scheduledAt,
    confirmedAt: r.confirmedAt,
    createdAt: r.createdAt,
    buyerName: r.buyerName,
    listingTitle: r.listingTitle,
    amountCents: r.amountCents ?? 0,
    locationName: r.locationName,
  }));
}

// ─── Reliability Events ──────────────────────────────────────────────────────

export async function getSellerReliabilityEvents(
  sellerId: string,
  limit = 50,
): Promise<ReliabilityEventRow[]> {
  return db
    .select({
      id: localReliabilityEvent.id,
      eventType: localReliabilityEvent.eventType,
      marksApplied: localReliabilityEvent.marksApplied,
      decaysAt: localReliabilityEvent.decaysAt,
      createdAt: localReliabilityEvent.createdAt,
    })
    .from(localReliabilityEvent)
    .where(eq(localReliabilityEvent.userId, sellerId))
    .orderBy(desc(localReliabilityEvent.createdAt))
    .limit(limit);
}
