/**
 * Local Schedule Nudge Job (G2.9 — Decision #117)
 *
 * Fires ~24hr after local transaction creation. If `scheduledAtConfirmedAt`
 * is still null (no time agreed), nudges both parties to schedule.
 * Is a no-op if time was already confirmed or transaction is terminal.
 *
 * Queue name: 'local-schedule-nudge' (hyphens per BullMQ project convention)
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const QUEUE_NAME = 'local-schedule-nudge';

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED'] as const;

interface LocalScheduleNudgeJobData {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  itemTitle: string;
}

export const localScheduleNudgeQueue = createQueue<LocalScheduleNudgeJobData>(QUEUE_NAME);

/**
 * Enqueue a scheduling-nudge job.
 * Delay is read from platform_settings (commerce.local.scheduleReminderHours, default 24).
 */
export async function enqueueLocalScheduleNudge(
  data: LocalScheduleNudgeJobData,
): Promise<void> {
  const scheduleReminderHours = await getPlatformSetting<number>(
    'commerce.local.scheduleReminderHours',
    24,
  );
  const delayMs = scheduleReminderHours * 60 * 60 * 1000;

  await localScheduleNudgeQueue.add('nudge', data, {
    jobId: `local-schedule-nudge-${data.localTransactionId}`,
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  });

  logger.info('[local-schedule-nudge] Enqueued schedule nudge', {
    localTransactionId: data.localTransactionId,
  });
}

async function processScheduleNudge(data: LocalScheduleNudgeJobData): Promise<void> {
  const [tx] = await db
    .select({
      status: localTransaction.status,
      scheduledAtConfirmedAt: localTransaction.scheduledAtConfirmedAt,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, data.localTransactionId))
    .limit(1);

  if (!tx) {
    logger.warn('[local-schedule-nudge] Transaction not found', {
      id: data.localTransactionId,
    });
    return;
  }

  // No-op if terminal status
  if ((TERMINAL_STATUSES as readonly string[]).includes(tx.status)) {
    logger.info('[local-schedule-nudge] Transaction is terminal, skipping', {
      id: data.localTransactionId,
      status: tx.status,
    });
    return;
  }

  // No-op if scheduling is already confirmed
  if (tx.scheduledAtConfirmedAt !== null) {
    logger.info('[local-schedule-nudge] Scheduling already confirmed, skipping', {
      id: data.localTransactionId,
    });
    return;
  }

  // Nudge both parties
  void notify(data.buyerId, 'local.schedule.reminder_setup', {
    itemTitle: data.itemTitle,
  });
  void notify(data.sellerId, 'local.schedule.reminder_setup', {
    itemTitle: data.itemTitle,
  });

  logger.info('[local-schedule-nudge] Nudge sent to both parties', {
    localTransactionId: data.localTransactionId,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
  });
}

export const localScheduleNudgeWorker = createWorker<LocalScheduleNudgeJobData>(
  QUEUE_NAME,
  async (job) => processScheduleNudge(job.data),
  1,
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await localScheduleNudgeWorker.close();
});
