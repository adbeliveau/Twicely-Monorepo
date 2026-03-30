/**
 * Development-only queue drain utility.
 *
 * Removes stale delayed/waiting jobs from local-transaction BullMQ queues
 * that accumulate in Valkey across dev server restarts. Without this,
 * workers pick up orphaned jobs on startup and log "transaction not found"
 * warnings for IDs like lt-1, lt-2, lt-reminder-001, etc.
 *
 * Only called in development (guarded by NODE_ENV check in instrumentation.ts).
 * In production, queues contain real jobs that must not be drained.
 */

import { Queue } from 'bullmq';
import { logger } from '@twicely/logger';

const LOCAL_TRANSACTION_QUEUE_NAMES = [
  'local-auto-cancel',
  'local-escrow-release',
  'local-noshow-check',
  'local-safety-timer',
  'local-meetup-reminder',
  'local-fraud-noshow-relist',
  'local-schedule-nudge',
  'local-day-of-confirmation-timeout',
] as const;

/**
 * Drain stale jobs from all local-transaction queues.
 * Creates temporary Queue instances to drain, then closes them.
 * The actual workers are created later when the job modules are imported.
 */
export async function drainLocalTransactionQueues(): Promise<void> {
  const connection = {
    host: process.env.VALKEY_HOST ?? '127.0.0.1',
    port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
    maxRetriesPerRequest: null as null,
  };

  let totalDrained = 0;

  for (const name of LOCAL_TRANSACTION_QUEUE_NAMES) {
    const queue = new Queue(name, { connection });
    try {
      const waiting = await queue.getWaitingCount();
      const delayed = await queue.getDelayedCount();
      const staleCount = waiting + delayed;
      if (staleCount > 0) {
        await queue.drain();
        totalDrained += staleCount;
      }
    } finally {
      await queue.close();
    }
  }

  if (totalDrained > 0) {
    logger.info('[drain-dev-queues] Drained stale local-transaction jobs', {
      totalDrained,
    });
  }
}
