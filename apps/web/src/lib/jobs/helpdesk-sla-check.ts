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
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

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
  const [slaWarningThreshold, slaBatchSize] = await Promise.all([
    getPlatformSetting<number>('helpdesk.sla.warningThreshold', 0.75),
    getPlatformSetting<number>('helpdesk.slaCheck.batchSize', 500),
  ]);

  const activeCases = await db
    .select({
      id: helpdeskCase.id,
      priority: helpdeskCase.priority,
      slaFirstResponseDueAt: helpdeskCase.slaFirstResponseDueAt,
      slaResolutionDueAt: helpdeskCase.slaResolutionDueAt,
      slaFirstResponseBreached: helpdeskCase.slaFirstResponseBreached,
      slaResolutionBreached: helpdeskCase.slaResolutionBreached,
      createdAt: helpdeskCase.createdAt,
      assignedAgentId: helpdeskCase.assignedAgentId,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      requesterId: helpdeskCase.requesterId,
    })
    .from(helpdeskCase)
    .where(
      and(
        inArray(helpdeskCase.status, ACTIVE_STATUSES),
        isNotNull(helpdeskCase.slaResolutionDueAt)
      )
    )
    .limit(slaBatchSize);

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

      if (c.assignedAgentId) {
        void notify(c.assignedAgentId, 'helpdesk.agent.sla_breach', {
          caseNumber: c.caseNumber,
          subject: c.subject,
        });
      }

      // Notify user if case was escalated
      if (policy?.escalateOnBreach && escalationTeamId) {
        void notify(c.requesterId, 'helpdesk.case.escalated_user', {
          caseNumber: c.caseNumber,
          subject: c.subject,
        });
      }

    } else if (!c.slaResolutionBreached && elapsedRatio >= slaWarningThreshold) {
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

      const remainingMs = resolutionDue - nowMs;
      const remainingMins = Math.max(1, Math.round(remainingMs / 60_000));
      const timeRemaining = remainingMins >= 60
        ? `${Math.round(remainingMins / 60)}h`
        : `${remainingMins}m`;

      if (c.assignedAgentId) {
        void notify(c.assignedAgentId, 'helpdesk.agent.sla_warning', {
          caseNumber: c.caseNumber,
          subject: c.subject,
          timeRemaining,
        });
      }
    }
  }

  logger.info('SLA check complete', { processed: activeCases.length });
}, 1);

export async function enqueueHelpdeskSlaCheck(): Promise<void> {
  const cronPattern = await getPlatformSetting<string>('helpdesk.cron.slaCheck.pattern', '*/5 * * * *');
  await queue.add(
    'sla-check',
    { triggeredAt: new Date().toISOString() },
    { jobId: 'helpdesk-sla-check', repeat: { pattern: cronPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 50 } },
  );
}
