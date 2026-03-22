/**
 * Helpdesk Auto-Close BullMQ Job
 *
 * Closes PENDING_USER cases past the auto-close threshold and
 * closes RESOLVED cases past the auto-close resolved threshold.
 *
 * Per TWICELY_V3_HELPDESK_CANONICAL.md §17.
 * Runs every 15 minutes on the `helpdesk` queue.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { helpdeskCase, caseEvent } from '@twicely/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'helpdesk-auto-close';

export interface HelpdeskAutoCloseData {
  triggeredAt: string;
}

const queue = createQueue<HelpdeskAutoCloseData>(QUEUE_NAME, {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
  },
});

createWorker<HelpdeskAutoCloseData>(QUEUE_NAME, async (_job) => {
  const [pendingDays, resolvedDays] = await Promise.all([
    getPlatformSetting<number>('helpdesk.autoClose.pendingUserDays', 14),
    getPlatformSetting<number>('helpdesk.autoClose.resolvedDays', 7),
  ]);

  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - pendingDays * 24 * 60 * 60 * 1000);
  const resolvedCutoff = new Date(now.getTime() - resolvedDays * 24 * 60 * 60 * 1000);

  // Auto-close stale PENDING_USER cases
  const stalePending = await db
    .select({ id: helpdeskCase.id })
    .from(helpdeskCase)
    .where(
      and(
        eq(helpdeskCase.status, 'PENDING_USER'),
        lt(helpdeskCase.lastActivityAt, pendingCutoff)
      )
    )
    .limit(100);

  if (stalePending.length > 0) {
    const ids = stalePending.map((c) => c.id);
    await db.update(helpdeskCase)
      .set({ status: 'CLOSED', closedAt: now, updatedAt: now, lastActivityAt: now })
      .where(inArray(helpdeskCase.id, ids));

    await db.insert(caseEvent).values(
      ids.map((caseId) => ({
        caseId,
        eventType: 'auto_closed',
        actorType: 'system',
        actorId: null,
        dataJson: { reason: 'pending_user_timeout', days: pendingDays },
      }))
    );

    logger.info('Auto-closed stale PENDING_USER cases', { count: ids.length });
  }

  // Auto-close stale RESOLVED cases
  const staleResolved = await db
    .select({ id: helpdeskCase.id })
    .from(helpdeskCase)
    .where(
      and(
        eq(helpdeskCase.status, 'RESOLVED'),
        lt(helpdeskCase.lastActivityAt, resolvedCutoff)
      )
    )
    .limit(100);

  if (staleResolved.length > 0) {
    const ids = staleResolved.map((c) => c.id);
    await db.update(helpdeskCase)
      .set({ status: 'CLOSED', closedAt: now, updatedAt: now, lastActivityAt: now })
      .where(inArray(helpdeskCase.id, ids));

    await db.insert(caseEvent).values(
      ids.map((caseId) => ({
        caseId,
        eventType: 'auto_closed',
        actorType: 'system',
        actorId: null,
        dataJson: { reason: 'resolved_timeout', days: resolvedDays },
      }))
    );

    logger.info('Auto-closed stale RESOLVED cases', { count: ids.length });
  }
}, 1);

export async function enqueueHelpdeskAutoClose(): Promise<void> {
  await queue.add(
    'auto-close',
    { triggeredAt: new Date().toISOString() },
    { jobId: 'helpdesk-auto-close', repeat: { pattern: '*/15 * * * *', tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 50 } },
  );
}
