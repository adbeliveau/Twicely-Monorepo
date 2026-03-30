/**
 * Local Escrow Release Job (G2.4)
 *
 * Enqueues a delayed job that marks a local transaction as COMPLETED
 * after the escrow hold period elapses (default: 72 hours).
 *
 * Flow:
 * 1. Buyer confirms receipt → status becomes RECEIPT_CONFIRMED
 * 2. This job is enqueued with a delay of `commerce.escrow.holdHours`
 * 3. After delay: worker checks status, upgrades to COMPLETED if still RECEIPT_CONFIRMED
 *
 * Idempotent: if status is already COMPLETED or DISPUTED, the job is a no-op.
 *
 * BullMQ queue name: 'local-escrow-release' (hyphens, not colons)
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'local-escrow-release';

interface LocalEscrowReleaseJobData {
  localTransactionId: string;
  orderId: string;
}

/**
 * Queue for local escrow release jobs.
 */
export const localEscrowReleaseQueue = createQueue<LocalEscrowReleaseJobData>(QUEUE_NAME);

/**
 * Enqueue a delayed escrow release for a confirmed local transaction.
 * Delay is read from platform_settings: commerce.escrow.holdHours (default: 72).
 *
 * @param localTransactionId - The local_transaction.id
 * @param orderId - The associated order.id
 */
export async function enqueueLocalEscrowRelease(
  localTransactionId: string,
  orderId: string,
): Promise<void> {
  const holdHours = await getPlatformSetting<number>('commerce.escrow.holdHours', 72);
  const delayMs = holdHours * 60 * 60 * 1000;

  await localEscrowReleaseQueue.add(
    'release',
    { localTransactionId, orderId },
    {
      jobId: `local-escrow-release-${localTransactionId}`,
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  logger.info('[local-escrow-release] Enqueued escrow release', {
    localTransactionId,
    orderId,
    holdHours,
    delayMs,
  });
}

/**
 * Process an escrow release job.
 * Verifies the transaction is still RECEIPT_CONFIRMED before completing.
 */
async function processEscrowRelease(
  localTransactionId: string,
  orderId: string,
): Promise<void> {
  const [txRow] = await db
    .select({ status: localTransaction.status })
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!txRow) {
    logger.warn('[local-escrow-release] Local transaction not found', { localTransactionId });
    return;
  }

  if (txRow.status === 'COMPLETED') {
    // Already completed — idempotent skip
    return;
  }

  if (txRow.status === 'DISPUTED') {
    // Disputed — admin resolves, skip automatic completion
    logger.info('[local-escrow-release] Skipping disputed transaction', { localTransactionId });
    return;
  }

  if (txRow.status !== 'RECEIPT_CONFIRMED') {
    logger.warn('[local-escrow-release] Unexpected status, skipping', {
      localTransactionId,
      status: txRow.status,
    });
    return;
  }

  const now = new Date();

  await db
    .update(localTransaction)
    .set({ status: 'COMPLETED', updatedAt: now })
    .where(eq(localTransaction.id, localTransactionId));

  await db
    .update(order)
    .set({ status: 'COMPLETED', completedAt: now, updatedAt: now })
    .where(eq(order.id, orderId));

  logger.info('[local-escrow-release] Released escrow, transaction completed', {
    localTransactionId,
    orderId,
  });
}

/**
 * Worker that processes local escrow release jobs.
 * Single concurrency — one release at a time.
 */
export const localEscrowReleaseWorker = createWorker<LocalEscrowReleaseJobData>(
  QUEUE_NAME,
  async (job) => {
    const { localTransactionId, orderId } = job.data;
    await processEscrowRelease(localTransactionId, orderId);
  },
  1,
);