/**
 * Local No-Show Detection BullMQ Job
 *
 * Detects when one party checks in to a meetup but the other does not
 * appear within the configured window. Charges the no-show fee, updates
 * the transaction status, and triggers suspension if needed.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL.md §7.
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { enqueueNoshowRelistCheck } from '@twicely/jobs/local-fraud-noshow-relist';
import { sendLocalAutoMessage } from './local-auto-messages';
import { logger } from '@twicely/logger';

// ─── Callback Types (DI to avoid circular dep on @twicely/commerce) ──────────

export interface LocalNoShowHandlers {
  canTransition: (from: string, to: string) => boolean;
  postReliabilityMark: (params: {
    userId: string;
    transactionId: string;
    eventType: string;
    marksApplied: number;
  }) => Promise<void>;
  unreserveListingForLocalTransaction: (orderId: string) => Promise<void>;
}

const QUEUE_NAME = 'local-noshow-check';

// ─── Job Data ─────────────────────────────────────────────────────────────────

export interface LocalNoShowCheckData {
  localTransactionId: string;
  checkedInParty: 'BUYER' | 'SELLER';
  checkedInAt: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export const localNoShowCheckQueue = createQueue<LocalNoShowCheckData>(QUEUE_NAME);

// ─── Enqueue Helper ───────────────────────────────────────────────────────────

/**
 * Schedule a no-show check job for after one party checks in.
 *
 * Delayed by `commerce.local.meetupAutoCancelMinutes` minutes.
 * jobId prevents duplicate checks for the same transaction + party.
 */
export async function enqueueNoShowCheck(
  localTransactionId: string,
  checkedInParty: 'BUYER' | 'SELLER',
  checkedInAt: Date,
): Promise<void> {
  const autoCancelMinutes = await getPlatformSetting<number>(
    'commerce.local.meetupAutoCancelMinutes',
    30,
  );
  const delayMs = autoCancelMinutes * 60 * 1000;

  await localNoShowCheckQueue.add(
    'check',
    {
      localTransactionId,
      checkedInParty,
      checkedInAt: checkedInAt.toISOString(),
    },
    {
      delay: delayMs,
      jobId: `noshow-${localTransactionId}-${checkedInParty}`,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Factory to create the no-show check worker.
 * Accepts LocalNoShowHandlers to avoid circular dep on @twicely/commerce.
 */
export function createLocalNoShowCheckWorker(handlers: LocalNoShowHandlers) {
  async function processNoShowCheck(data: LocalNoShowCheckData): Promise<void> {
    const { localTransactionId, checkedInParty } = data;

    const [tx] = await db
      .select()
      .from(localTransaction)
      .where(eq(localTransaction.id, localTransactionId))
      .limit(1);

    if (!tx) {
      logger.error('[local-noshow-check] Transaction not found', { localTransactionId });
      return;
    }

    // Skip if already in a terminal or resolved state
    const skipStatuses = [
      'BOTH_CHECKED_IN',
      'RECEIPT_CONFIRMED',
      'COMPLETED',
      'CANCELED',
      'DISPUTED',
    ] as const;

    if (skipStatuses.includes(tx.status as (typeof skipStatuses)[number])) {
      return;
    }

    // Determine no-show party based on who checked in and current status
    let noShowParty: 'BUYER' | 'SELLER' | null = null;

    if (tx.status === 'SELLER_CHECKED_IN' && checkedInParty === 'SELLER') {
      noShowParty = 'BUYER';
    } else if (tx.status === 'BUYER_CHECKED_IN' && checkedInParty === 'BUYER') {
      noShowParty = 'SELLER';
    }

    if (!noShowParty) {
      return;
    }

    // Verify the transition is valid
    if (!handlers.canTransition(tx.status, 'NO_SHOW')) {
      logger.error('[local-noshow-check] Cannot transition to NO_SHOW', {
        localTransactionId,
        currentStatus: tx.status,
      });
      return;
    }

    const now = new Date();

    // Update local transaction: mark no-show (do not write fee fields)
    await db
      .update(localTransaction)
      .set({
        status: 'NO_SHOW',
        noShowParty,
        updatedAt: now,
      })
      .where(eq(localTransaction.id, localTransactionId));

    // Cancel the associated order
    await db
      .update(order)
      .set({
        status: 'CANCELED',
        cancelInitiator: 'SYSTEM',
        cancelReason: 'No-show at local meetup',
        canceledAt: now,
        updatedAt: now,
      })
      .where(eq(order.id, tx.orderId));

    logger.info('[local-noshow-check] No-show detected', {
      localTransactionId,
      noShowParty,
    });

    // Unreserve listing immediately — NO_SHOW is terminal, no rescheduling possible
    await handlers.unreserveListingForLocalTransaction(tx.orderId);

    // G2.15: Enqueue 24-hour relist check for fraud detection (Signal 3)
    await enqueueNoshowRelistCheck(localTransactionId, tx.sellerId, tx.orderId);

    // Post auto-message to the linked conversation
    void sendLocalAutoMessage(tx.orderId, 'NO_SHOW', {
      noShowParty: noShowParty === 'BUYER' ? 'Buyer' : 'Seller',
    });

    // Post reliability mark — suspension handled inside postReliabilityMark
    const noShowUserId = noShowParty === 'BUYER' ? tx.buyerId : tx.sellerId;
    const markNoShow = await getPlatformSetting<number>('commerce.local.markNoShow', -3);
    await handlers.postReliabilityMark({
      userId: noShowUserId,
      transactionId: localTransactionId,
      eventType: noShowParty === 'BUYER' ? 'BUYER_NOSHOW' : 'SELLER_NOSHOW',
      marksApplied: markNoShow,
    });
  }

  return createWorker<LocalNoShowCheckData>(
    QUEUE_NAME,
    async (job) => {
      await processNoShowCheck(job.data);
    },
    1,
  );
}
