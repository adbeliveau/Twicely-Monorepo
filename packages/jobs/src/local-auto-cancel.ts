/**
 * Local Auto-Cancel Job (G2.5 / G2.6)
 *
 * Enqueues a delayed job that cancels a local transaction if it has not been
 * completed after 48 hours. If either/both parties checked in but no receipt
 * was confirmed, an URGENT helpdesk case is opened for investigation.
 *
 * BullMQ queue name: 'local-auto-cancel' (hyphens, not colons)
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { localTransaction, order, helpdeskCase } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const QUEUE_NAME = 'local-auto-cancel';

/** Statuses that indicate partial or full check-in — warrant investigation */
const INVESTIGATION_STATUSES = [
  'SELLER_CHECKED_IN',
  'BUYER_CHECKED_IN',
  'BOTH_CHECKED_IN',
] as const;

type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

function isInvestigationStatus(status: string): status is InvestigationStatus {
  return (INVESTIGATION_STATUSES as readonly string[]).includes(status);
}

interface LocalAutoCancelJobData {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
}

export const localAutoCancelQueue = createQueue<LocalAutoCancelJobData>(QUEUE_NAME);

/**
 * Enqueue an auto-cancel job for a local transaction.
 * Delay is read from platform_settings (commerce.local.autoCancelHours, default 48).
 */
export async function enqueueLocalAutoCancel(data: LocalAutoCancelJobData): Promise<void> {
  const autoCancelHours = await getPlatformSetting<number>('commerce.local.autoCancelHours', 48);
  const delayMs = autoCancelHours * 60 * 60 * 1000;

  await localAutoCancelQueue.add('cancel', data, {
    jobId: `local-auto-cancel-${data.localTransactionId}`,
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  });

  logger.info('[local-auto-cancel] Enqueued auto-cancel', {
    localTransactionId: data.localTransactionId,
  });
}

async function processAutoCancel(data: LocalAutoCancelJobData): Promise<void> {
  const [tx] = await db
    .select({ status: localTransaction.status })
    .from(localTransaction)
    .where(eq(localTransaction.id, data.localTransactionId))
    .limit(1);

  if (!tx) {
    logger.warn('[local-auto-cancel] Transaction not found', { id: data.localTransactionId });
    return;
  }

  const terminalStatuses = ['COMPLETED', 'CANCELED', 'RECEIPT_CONFIRMED', 'NO_SHOW', 'DISPUTED'];
  if (terminalStatuses.includes(tx.status)) {
    logger.info('[local-auto-cancel] Transaction already resolved, skipping', {
      id: data.localTransactionId,
      status: tx.status,
    });
    return;
  }

  const needsInvestigation = isInvestigationStatus(tx.status);
  const now = new Date();

  // Cancel the transaction and linked order
  await db
    .update(localTransaction)
    .set({ status: 'CANCELED', updatedAt: now })
    .where(eq(localTransaction.id, data.localTransactionId));

  await db
    .update(order)
    .set({ status: 'CANCELED', updatedAt: now })
    .where(eq(order.id, data.orderId));

  // Notify both parties
  void notify(data.buyerId, 'local.auto_cancel', { orderId: data.orderId });
  void notify(data.sellerId, 'local.auto_cancel', { orderId: data.orderId });

  if (needsInvestigation) {
    const caseNumber = `CASE-${Date.now()}`;

    await db.insert(helpdeskCase).values({
      id: createId(),
      caseNumber,
      type: 'ORDER',
      priority: 'URGENT',
      subject: `Investigation required: local meetup timeout — order ${data.orderId}`,
      description:
        `Local transaction auto-canceled after timeout. Status at time of cancel: ${tx.status}. ` +
        'Check-in was recorded but receipt was never confirmed.',
      status: 'NEW',
      channel: 'SYSTEM',
      requesterId: data.sellerId,
      requesterType: 'seller',
      orderId: data.orderId,
    });

    logger.info('[local-auto-cancel] Investigation case created', {
      localTransactionId: data.localTransactionId,
      caseNumber,
      statusAtCancel: tx.status,
    });
  }

  logger.info('[local-auto-cancel] Auto-cancel complete', {
    localTransactionId: data.localTransactionId,
    needsInvestigation,
  });
}

export const localAutoCancelWorker = createWorker<LocalAutoCancelJobData>(
  QUEUE_NAME,
  async (job) => processAutoCancel(job.data),
  1,
);