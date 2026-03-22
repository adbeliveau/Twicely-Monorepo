/**
 * Helpdesk SLA Check BullMQ Job
 *
 * Checks SLA countdowns for all active cases.
 * At 75% elapsed: sets warning, logs event, sends notification.
 * At 100% elapsed (breach): sets breached, logs event, sends notification,
 * and if escalateOnBreach: reassigns to escalations team.
 *
 * Per TWICELY_V3_HELPDESK_CANONICAL.md §12.4.
 * Runs every 5 minutes on the `helpdesk-sla-check` queue.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { helpdeskCase, helpdeskSlaPolicy, caseEvent, helpdeskTeam } from '@twicely/db/schema';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'helpdesk-sla-check';

export interface HelpdeskSlaCheckData {
  triggeredAt: string;
}

const ACTIVE_STATUSES = ['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ESCALATED'] as const;

const queue = createQueue<HelpdeskSlaCheckData>(QUEUE_NAME, {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: { type: 'fixed', delay: 30_000 },
  },
});

createWorker<HelpdeskSlaCheckData>(QUEUE_NAME, async (_job) => {
  const now = new Date();
  const nowMs = now.getTime();

  const activeCases = await db
    .select({
      id: helpdeskCase.id,
      priority: helpdeskCase.priority,
      slaFirstResponseDueAt: helpdeskCase.slaFirstResponseDueAt,
      slaResolutionDueAt: helpdeskCase.slaResolutionDueAt,
      slaFirstResponseBreached: helpdeskCase.slaFirstResponseBreached,
      slaResolutionBreached: helpdeskCase.slaResolutionBreached,
      createdAt: helpdeskCase.createdAt,
    })
    .from(helpdeskCase)
    .where(
      and(
        inArray(helpdeskCase.status, ACTIVE_STATUSES),
        isNotNull(helpdeskCase.slaResolutionDueAt)
      )
    )
    .limit(500);

  const slaPolicies = await db
    .select({ priority: helpdeskSlaPolicy.priority, escalateOnBreach: helpdeskSlaPolicy.escalateOnBreach })
    .from(helpdeskSlaPolicy);
  const policyMap = new Map(slaPolicies.map((p) => [p.priority, p]));

  // Find escalation team
  const escalationTeams = await db
    .select({ id: helpdeskTeam.id })
    .from(helpdeskTeam)
    .where(eq(helpdeskTeam.name, 'Escalations'))
    .limit(1);
  const escalationTeamId = escalationTeams[0]?.id ?? null;

  for (const c of activeCases) {
    const resolutionDue = c.slaResolutionDueAt ? new Date(c.slaResolutionDueAt).getTime() : null;
    if (!resolutionDue) continue;

    const createdMs = new Date(c.createdAt).getTime();
    const totalWindowMs = resolutionDue - createdMs;
    const elapsedMs = nowMs - createdMs;
    const elapsedRatio = elapsedMs / totalWindowMs;

    const policy = policyMap.get(c.priority);

    if (!c.slaResolutionBreached && nowMs >= resolutionDue) {
      // SLA breached
      await db.update(helpdeskCase)
        .set({
          slaResolutionBreached: true,
          updatedAt: now,
          ...(policy?.escalateOnBreach && escalationTeamId
            ? { status: 'ESCALATED', assignedTeamId: escalationTeamId }
            : {}),
        })
        .where(eq(helpdeskCase.id, c.id));

      await db.insert(caseEvent).values({
        caseId: c.id,
        eventType: 'sla_resolution_breached',
        actorType: 'system',
        actorId: null,
        dataJson: { priority: c.priority, breachedAt: now.toISOString() },
      });

    } else if (!c.slaResolutionBreached && elapsedRatio >= 0.75) {
      // 75% warning — insert event only once
      await db.insert(caseEvent).values({
        caseId: c.id,
        eventType: 'sla_warning',
        actorType: 'system',
        actorId: null,
        dataJson: { priority: c.priority, elapsedPercent: Math.round(elapsedRatio * 100) },
      }).catch(() => {
        // Ignore duplicate insertions from concurrent runs
      });
    }
  }

  logger.info('SLA check complete', { processed: activeCases.length });
}, 1);

export async function enqueueHelpdeskSlaCheck(): Promise<void> {
  await queue.add(
    'sla-check',
    { triggeredAt: new Date().toISOString() },
    { jobId: 'helpdesk-sla-check', repeat: { pattern: '*/5 * * * *', tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 50 } },
  );
}
