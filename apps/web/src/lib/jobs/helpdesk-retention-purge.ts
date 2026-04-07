/**
 * Helpdesk Retention Purge BullMQ Job
 *
 * Deletes CLOSED cases whose closedAt timestamp is older than
 * helpdesk.retentionDays from platform_settings (default 365 days).
 * Runs daily. Limits to 200 cases per run.
 *
 * Per TWICELY_V3_HELPDESK_CANONICAL.md §24.1 and §26.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { helpdeskCase, caseMessage, caseEvent, caseWatcher, caseCsat } from '@twicely/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'helpdesk-retention-purge';

export interface HelpdeskRetentionPurgeData {
  triggeredAt: string;
}

const queue = createQueue<HelpdeskRetentionPurgeData>(QUEUE_NAME, {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
  },
});

createWorker<HelpdeskRetentionPurgeData>(QUEUE_NAME, async (_job) => {
  const [retentionDays, retentionBatchSize] = await Promise.all([
    getPlatformSetting<number>('helpdesk.retentionDays', 365),
    getPlatformSetting<number>('helpdesk.retentionPurge.batchSize', 200),
  ]);

  if (retentionDays <= 0) {
    logger.warn('[retention-purge] retentionDays <= 0 — skipping purge run');
    return;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const expiredCases = await db
    .select({ id: helpdeskCase.id })
    .from(helpdeskCase)
    .where(
      and(
        eq(helpdeskCase.status, 'CLOSED'),
        lt(helpdeskCase.closedAt, cutoff)
      )
    )
    .limit(retentionBatchSize);

  if (expiredCases.length === 0) {
    logger.info('[retention-purge] No cases to purge');
    return;
  }

  const ids = expiredCases.map((c) => c.id);

  // Delete dependent rows with no FK cascade, then cascaded rows, then the case itself
  await db.delete(caseCsat).where(inArray(caseCsat.caseId, ids));
  await db.delete(caseWatcher).where(inArray(caseWatcher.caseId, ids));
  await db.delete(caseEvent).where(inArray(caseEvent.caseId, ids));
  await db.delete(caseMessage).where(inArray(caseMessage.caseId, ids));
  await db.delete(helpdeskCase).where(inArray(helpdeskCase.id, ids));

  logger.info('[retention-purge] Purged expired cases', { count: ids.length, cutoff: cutoff.toISOString() });
}, 1);

export async function enqueueHelpdeskRetentionPurge(): Promise<void> {
  const cronPattern = await getPlatformSetting<string>('helpdesk.cron.retentionPurge.pattern', '0 4 * * *');
  await queue.add(
    'retention-purge',
    { triggeredAt: new Date().toISOString() },
    { jobId: 'helpdesk-retention-purge', repeat: { pattern: cronPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 50 } },
  );
}
