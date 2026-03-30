/**
 * Day-of Confirmation Timeout BullMQ Job (G2.12)
 *
 * Fires when the seller's 2-hour response window expires after the buyer
 * sends a day-of confirmation request. Posts SELLER_DARK reliability mark
 * and notifies both parties.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A9
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { postReliabilityMark } from '@twicely/commerce/local-reliability';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'local-day-of-confirmation-timeout';

// ─── Job Data ─────────────────────────────────────────────────────────────────

export interface DayOfConfirmationTimeoutData {
  localTransactionId: string;
  orderId: string;
  sellerId: string;
  buyerId: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export const dayOfConfirmationTimeoutQueue =
  createQueue<DayOfConfirmationTimeoutData>(QUEUE_NAME);

// ─── Enqueue Helper ───────────────────────────────────────────────────────────

/**
 * Schedule a day-of confirmation timeout job.
 * Delayed by `commerce.local.dayOfConfirmationResponseHours` hours.
 * jobId is unique per transaction so duplicate jobs are prevented.
 */
export async function enqueueDayOfConfirmationTimeout(
  data: DayOfConfirmationTimeoutData,
): Promise<void> {
  const responseHours = await getPlatformSetting<number>(
    'commerce.local.dayOfConfirmationResponseHours',
    2,
  );
  const delayMs = responseHours * 60 * 60 * 1000;

  await dayOfConfirmationTimeoutQueue.add(
    'timeout',
    data,
    {
      delay: delayMs,
      jobId: `day-of-confirm-timeout-${data.localTransactionId}`,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

// ─── Terminal Statuses ────────────────────────────────────────────────────────

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED'] as const;

function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

// ─── Processing Logic ─────────────────────────────────────────────────────────

async function processDayOfConfirmationTimeout(
  data: DayOfConfirmationTimeoutData,
): Promise<void> {
  const { localTransactionId } = data;

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!tx) {
    logger.warn('[local-day-of-timeout] Transaction not found', { localTransactionId });
    return;
  }

  // No-op: terminal status
  if (isTerminalStatus(tx.status)) {
    logger.info('[local-day-of-timeout] Transaction in terminal status, skipping', {
      localTransactionId,
      status: tx.status,
    });
    return;
  }

  // No-op: seller already responded — race condition guard
  if (tx.dayOfConfirmationRespondedAt !== null) {
    logger.info('[local-day-of-timeout] Seller already responded, skipping', {
      localTransactionId,
    });
    return;
  }

  // No-op: already processed (idempotent)
  if (tx.dayOfConfirmationExpired === true) {
    logger.info('[local-day-of-timeout] Already expired, skipping (idempotent)', {
      localTransactionId,
    });
    return;
  }

  // No-op: seller chose to reschedule — counts as a valid response, no mark
  if (tx.status === 'RESCHEDULE_PENDING') {
    logger.info('[local-day-of-timeout] Seller proposed reschedule, skipping SELLER_DARK mark', {
      localTransactionId,
    });
    return;
  }

  const now = new Date();

  // Mark as expired
  await db
    .update(localTransaction)
    .set({ dayOfConfirmationExpired: true, updatedAt: now })
    .where(eq(localTransaction.id, localTransactionId));

  // Post SELLER_DARK reliability mark
  const markSellerDark = await getPlatformSetting<number>(
    'commerce.local.markSellerDark',
    -1,
  );
  await postReliabilityMark({
    userId: tx.sellerId,
    transactionId: localTransactionId,
    eventType: 'SELLER_DARK',
    marksApplied: markSellerDark,
  });

  logger.info('[local-day-of-timeout] SELLER_DARK mark posted', {
    localTransactionId,
    sellerId: tx.sellerId,
    marksApplied: markSellerDark,
  });

  // Notify buyer: seller did not confirm
  const scheduledAtDate = tx.scheduledAt !== null ? new Date(tx.scheduledAt) : null;
  const timeStr = scheduledAtDate !== null
    ? scheduledAtDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  void notify(tx.buyerId, 'local.dayof.expired', { time: timeStr });
  void notify(tx.sellerId, 'local.dayof.expired_seller', { time: timeStr });
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const dayOfConfirmationTimeoutWorker =
  createWorker<DayOfConfirmationTimeoutData>(
    QUEUE_NAME,
    async (job) => {
      await processDayOfConfirmationTimeout(job.data);
    },
    1,
  );