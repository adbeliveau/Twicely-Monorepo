/**
 * Local Reliability System (G2.8 — Decision #114)
 * Mark-based reliability tracking. Replaces monetary no-show fee system.
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A5
 */

import { db } from '@twicely/db';
import {
  localReliabilityEvent,
  localTransaction,
  user,
} from '@twicely/db/schema';
import { eq, gt, sum, count, and, desc } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalReliabilityEventType =
  | 'BUYER_CANCEL_GRACEFUL'
  | 'BUYER_CANCEL_LATE'
  | 'BUYER_CANCEL_SAMEDAY'
  | 'BUYER_NOSHOW'
  | 'SELLER_CANCEL_GRACEFUL'
  | 'SELLER_CANCEL_LATE'
  | 'SELLER_CANCEL_SAMEDAY'
  | 'SELLER_NOSHOW'
  | 'SELLER_DARK'
  | 'RESCHEDULE_EXCESS';

export type LocalReliabilityEventRow = typeof localReliabilityEvent.$inferSelect;

export interface PostReliabilityMarkParams {
  userId: string;
  transactionId: string;
  eventType: LocalReliabilityEventType;
  marksApplied: number; // negative integer (e.g., -1, -2, -3)
}

export interface ReliabilityDisplay {
  tier: 'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE';
  completedCount: number;
  completionRate: number; // 0.0 to 1.0
  isSuspended: boolean;
  suspendedUntil: Date | null;
}

// ─── Post Reliability Mark ────────────────────────────────────────────────────

/**
 * Record a reliability event and update user's cached mark total.
 * marksApplied is negative (e.g., -3 for no-show). 0 = no-op.
 */
export async function postReliabilityMark(
  params: PostReliabilityMarkParams,
): Promise<void> {
  const { userId, transactionId, eventType, marksApplied } = params;

  // Graceful cancellations do not create a reliability event
  if (marksApplied === 0) {
    return;
  }

  const markDecayDays = await getPlatformSetting<number>(
    'commerce.local.markDecayDays',
    180,
  );

  const now = new Date();
  const decaysAt = new Date(now);
  decaysAt.setDate(decaysAt.getDate() + markDecayDays);

  await db.insert(localReliabilityEvent).values({
    userId,
    transactionId,
    eventType,
    marksApplied,
    decaysAt,
    createdAt: now,
  });

  logger.info('[local-reliability] Mark posted', {
    userId,
    transactionId,
    eventType,
    marksApplied,
    decaysAt,
  });

  await recalculateReliabilityMarks(userId);
}

// ─── Recalculate Reliability Marks ────────────────────────────────────────────

/**
 * Recompute cached reliability fields from the event log.
 * Updates localReliabilityMarks, localSuspendedUntil, counts, rate.
 */
export async function recalculateReliabilityMarks(userId: string): Promise<void> {
  const now = new Date();

  // Sum active (non-decayed) marks — stored as negative integers
  const [marksRow] = await db
    .select({ total: sum(localReliabilityEvent.marksApplied) })
    .from(localReliabilityEvent)
    .where(
      and(
        eq(localReliabilityEvent.userId, userId),
        gt(localReliabilityEvent.decaysAt, now),
      ),
    );

  const rawSum = marksRow?.total !== null ? Number(marksRow?.total ?? 0) : 0;
  // marksApplied are negative; absolute value = active mark count
  const activeMarks = Math.abs(rawSum);

  const threshold = await getPlatformSetting<number>(
    'commerce.local.suspensionMarkThreshold',
    9,
  );
  const suspensionDays = await getPlatformSetting<number>(
    'commerce.local.suspensionDays',
    90,
  );

  // Read current user suspension state
  const [userRow] = await db
    .select({ localSuspendedUntil: user.localSuspendedUntil })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const currentSuspendedUntil = userRow?.localSuspendedUntil ?? null;
  const isCurrentlySuspended =
    currentSuspendedUntil !== null && currentSuspendedUntil > now;

  // Compute new suspension — only set when crossing threshold, don't re-extend
  let newSuspendedUntil: Date | null = currentSuspendedUntil;
  if (activeMarks >= threshold && !isCurrentlySuspended) {
    newSuspendedUntil = new Date(now);
    newSuspendedUntil.setDate(newSuspendedUntil.getDate() + suspensionDays);
    logger.info('[local-reliability] Suspension applied', {
      userId,
      activeMarks,
      threshold,
      suspendedUntil: newSuspendedUntil,
    });
  }

  // Compute localTransactionCount and localCompletionRate
  const { txCount, completedCount } = await getLocalTransactionStats(userId);
  const completionRate =
    txCount > 0 ? completedCount / txCount : null;

  await db
    .update(user)
    .set({
      localReliabilityMarks: activeMarks,
      localSuspendedUntil: newSuspendedUntil,
      localTransactionCount: txCount,
      localCompletionRate: completionRate,
      updatedAt: now,
    })
    .where(eq(user.id, userId));
}

// ─── Local Transaction Stats Helper ───────────────────────────────────────────

async function getLocalTransactionStats(
  userId: string,
): Promise<{ txCount: number; completedCount: number }> {
  // All localTransaction rows are "attempted" — no DRAFT status exists.
  // Count transactions where user is buyer or seller.
  const [buyerCountRow] = await db
    .select({ total: count() })
    .from(localTransaction)
    .where(eq(localTransaction.buyerId, userId));

  const [sellerCountRow] = await db
    .select({ total: count() })
    .from(localTransaction)
    .where(eq(localTransaction.sellerId, userId));

  const [buyerCompletedRow] = await db
    .select({ total: count() })
    .from(localTransaction)
    .where(
      and(
        eq(localTransaction.buyerId, userId),
        eq(localTransaction.status, 'COMPLETED'),
      ),
    );

  const [sellerCompletedRow] = await db
    .select({ total: count() })
    .from(localTransaction)
    .where(
      and(
        eq(localTransaction.sellerId, userId),
        eq(localTransaction.status, 'COMPLETED'),
      ),
    );

  const txCount =
    Number(buyerCountRow?.total ?? 0) + Number(sellerCountRow?.total ?? 0);
  const completedCount =
    Number(buyerCompletedRow?.total ?? 0) + Number(sellerCompletedRow?.total ?? 0);

  return { txCount, completedCount };
}

// ─── Suspension Check ─────────────────────────────────────────────────────────

/** Returns whether a user is suspended from local transactions. */
export async function isUserSuspendedFromLocal(
  userId: string,
): Promise<{ suspended: boolean; reason?: 'fraud_ban' | 'reliability'; resumesAt?: Date }> {
  const [userRow] = await db
    .select({
      localSuspendedUntil: user.localSuspendedUntil,
      localFraudBannedAt: user.localFraudBannedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // G2.15: Fraud ban is permanent — checked first, no resumesAt
  if (userRow?.localFraudBannedAt !== null && userRow?.localFraudBannedAt !== undefined) {
    return { suspended: true, reason: 'fraud_ban' };
  }

  const suspendedUntil = userRow?.localSuspendedUntil ?? null;
  const now = new Date();

  if (suspendedUntil === null || suspendedUntil <= now) {
    return { suspended: false };
  }

  return { suspended: true, reason: 'reliability', resumesAt: suspendedUntil };
}

// ─── Reliability Display ──────────────────────────────────────────────────────

/**
 * Public-facing reliability tier for meetup screen display.
 * RELIABLE = 0-2 marks, INCONSISTENT = 3-8, UNRELIABLE = 9+
 */
export async function getReliabilityDisplay(
  userId: string,
): Promise<ReliabilityDisplay> {
  const [userRow] = await db
    .select({
      localReliabilityMarks: user.localReliabilityMarks,
      localTransactionCount: user.localTransactionCount,
      localCompletionRate: user.localCompletionRate,
      localSuspendedUntil: user.localSuspendedUntil,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const marks = userRow?.localReliabilityMarks ?? 0;
  const completedCount = userRow?.localTransactionCount ?? 0;
  const completionRate = userRow?.localCompletionRate ?? 0;
  const suspendedUntil = userRow?.localSuspendedUntil ?? null;
  const now = new Date();
  const isSuspended = suspendedUntil !== null && suspendedUntil > now;

  const suspensionThreshold = await getPlatformSetting<number>('commerce.local.suspensionMarkThreshold', 9);
  const inconsistentThreshold = await getPlatformSetting<number>('commerce.local.inconsistentMarkThreshold', 3);

  let tier: 'RELIABLE' | 'INCONSISTENT' | 'UNRELIABLE';
  if (marks >= suspensionThreshold) {
    tier = 'UNRELIABLE';
  } else if (marks >= inconsistentThreshold) {
    tier = 'INCONSISTENT';
  } else {
    tier = 'RELIABLE';
  }

  return {
    tier,
    completedCount,
    completionRate,
    isSuspended,
    suspendedUntil: isSuspended ? suspendedUntil : null,
  };
}

// ─── Reliability Event History ────────────────────────────────────────────────

/** Returns a user's reliability event history, ordered by createdAt DESC. */
export async function getReliabilityEvents(
  userId: string,
  limit?: number,
): Promise<LocalReliabilityEventRow[]> {
  const query = db
    .select()
    .from(localReliabilityEvent)
    .where(eq(localReliabilityEvent.userId, userId))
    .orderBy(desc(localReliabilityEvent.createdAt));

  if (limit !== undefined) {
    return query.limit(limit);
  }

  return query;
}
