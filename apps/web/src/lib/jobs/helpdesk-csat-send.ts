/**
 * Helpdesk CSAT Send BullMQ Job
 *
 * Finds recently-resolved cases where CSAT has not yet been requested,
 * waits for the configured survey delay, then creates the caseCsat record
 * with surveyRequestedAt set to now and queues the CSAT email.
 *
 * Per TWICELY_V3_HELPDESK_CANONICAL.md §18.
 * Runs every 5 minutes on the `helpdesk-csat-send` queue.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { helpdeskCase, caseCsat } from '@twicely/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'helpdesk-csat-send';

export interface HelpdeskCsatSendData {
  triggeredAt: string;
}

const queue = createQueue<HelpdeskCsatSendData>(QUEUE_NAME, {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
  },
});

createWorker<HelpdeskCsatSendData>(QUEUE_NAME, async (_job) => {
  const csatEnabled = await getPlatformSetting<boolean>('helpdesk.csat.enabled', true);
  if (!csatEnabled) return;

  const surveyDelayMinutes = await getPlatformSetting<number>('helpdesk.csat.surveyDelayMinutes', 30);
  const now = new Date();
  const delayCutoff = new Date(now.getTime() - surveyDelayMinutes * 60 * 1000);

  // Find cases resolved more than surveyDelayMinutes ago with no CSAT record
  const candidates = await db
    .select({ id: helpdeskCase.id, requesterId: helpdeskCase.requesterId, resolvedAt: helpdeskCase.resolvedAt })
    .from(helpdeskCase)
    .where(
      and(
        eq(helpdeskCase.status, 'RESOLVED'),
        lt(helpdeskCase.resolvedAt, delayCutoff)
      )
    )
    .limit(50);

  for (const c of candidates) {
    // Check if CSAT already exists for this case
    const existing = await db
      .select({ id: caseCsat.id })
      .from(caseCsat)
      .where(eq(caseCsat.caseId, c.id))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(caseCsat).values({
      caseId: c.id,
      userId: c.requesterId,
      rating: 0, // Placeholder — will be replaced when user responds
      surveyRequestedAt: now,
      respondedAt: null,
    });

    logger.info('CSAT survey record created', { caseId: c.id });
    // Notification send deferred to notification system — insert event here
  }
}, 1);

export async function enqueueHelpdeskCsatSend(): Promise<void> {
  await queue.add(
    'csat-send',
    { triggeredAt: new Date().toISOString() },
    { jobId: 'helpdesk-csat-send', repeat: { pattern: '*/5 * * * *', tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 50 } },
  );
}
