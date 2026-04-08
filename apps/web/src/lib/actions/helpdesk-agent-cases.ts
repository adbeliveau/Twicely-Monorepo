'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { helpdeskCase, caseMessage, caseEvent, helpdeskTeamMember, staffUser } from '@twicely/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  agentReplySchema,
  updateCaseStatusSchema,
  assignCaseSchema,
} from '@/lib/validations/helpdesk';
import { notifyCaseWatchers } from '@/lib/helpdesk/notify-watchers';
import { notify } from '@twicely/notifications/service';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/** Extract staff IDs from structured mentions like @[Display Name](staff:abc123) */
function extractMentionedStaffIds(body: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(staff:([a-z0-9]+)\)/g;
  const ids: string[] = [];
  let match;
  while ((match = mentionRegex.exec(body)) !== null) {
    if (match[2]) ids.push(match[2]);
  }
  return [...new Set(ids)];
}

/** Staff replies to a case */
export async function addAgentReply(formData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = agentReplySchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { caseId, body, bodyHtml, isInternal } = parsed.data;
  const direction = isInternal ? ('INTERNAL' as const) : ('OUTBOUND' as const);
  const now = new Date();

  const existingCase = await db
    .select({ id: helpdeskCase.id, firstResponseAt: helpdeskCase.firstResponseAt, requesterId: helpdeskCase.requesterId, status: helpdeskCase.status, caseNumber: helpdeskCase.caseNumber, subject: helpdeskCase.subject })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const caseRecord = existingCase[0];
  if (!caseRecord) return { success: false, error: 'Not found' };

  await db.insert(caseMessage).values({
    caseId,
    senderType: 'agent',
    senderId: session.staffUserId,
    senderName: session.displayName,
    direction,
    body,
    bodyHtml: bodyHtml ?? null,
    attachments: sql`'[]'`,
  });

  const updateFields: Partial<typeof helpdeskCase.$inferInsert> = { updatedAt: now, lastActivityAt: now };
  if (direction === 'OUTBOUND' && !caseRecord.firstResponseAt) {
    updateFields.firstResponseAt = now;
  }
  if (direction === 'OUTBOUND' && caseRecord.status === 'NEW') {
    updateFields.status = 'OPEN';
  }

  await db.update(helpdeskCase).set(updateFields).where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: isInternal ? 'internal_note' : 'agent_reply',
    actorType: 'agent',
    actorId: session.staffUserId,
    dataJson: { isInternal },
  });

  notifyCaseWatchers(caseId, session.staffUserId, isInternal ? 'New internal note added' : 'New reply sent').catch(() => undefined);

  // Parse @mentions in internal notes and notify mentioned agents
  if (isInternal) {
    const mentionedIds = extractMentionedStaffIds(body)
      .filter((id) => id !== session.staffUserId);
    if (mentionedIds.length > 0) {
      const validStaff = await db
        .select({ id: staffUser.id })
        .from(staffUser)
        .where(and(eq(staffUser.isActive, true), inArray(staffUser.id, mentionedIds)));
      for (const s of validStaff) {
        void notify(s.id, 'helpdesk.agent.mention', {
          mentionedBy: session.displayName,
          caseNumber: caseRecord.caseNumber,
          subject: caseRecord.subject,
        });
      }
    }
  }

  if (!isInternal) {
    void notify(caseRecord.requesterId, 'helpdesk.case.agent_reply', {});
  }

  revalidatePath(`/hd/cases/${caseId}`);
  return { success: true };
}

/** Agent changes case status */
export async function updateCaseStatus(formData: unknown): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = updateCaseStatusSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { caseId, status } = parsed.data;
  const now = new Date();

  const existingCase = await db
    .select({
      id: helpdeskCase.id,
      status: helpdeskCase.status,
      requesterId: helpdeskCase.requesterId,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
    })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const existingStatusRow = existingCase[0];
  if (!existingStatusRow) return { success: false, error: 'Not found' };
  const oldStatus = existingStatusRow.status;

  const updateFields: Partial<typeof helpdeskCase.$inferInsert> = { status, updatedAt: now, lastActivityAt: now };
  if (status === 'RESOLVED') updateFields.resolvedAt = now;

  await db.update(helpdeskCase).set(updateFields).where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'status_changed',
    actorType: 'agent',
    actorId: null,
    dataJson: { oldStatus, newStatus: status },
  });

  notifyCaseWatchers(caseId, '', `Status changed to ${status}`).catch(() => undefined);

  // Notify the user about the status change
  if (status === 'RESOLVED') {
    void notify(existingStatusRow.requesterId, 'helpdesk.case.resolved', {
      caseNumber: existingStatusRow.caseNumber,
      reopenWindowDays: '7',
      caseUrl: `/my/support/${caseId}`,
    });
  } else if (status === 'ESCALATED') {
    void notify(existingStatusRow.requesterId, 'helpdesk.case.escalated_user', {
      caseNumber: existingStatusRow.caseNumber,
      subject: existingStatusRow.subject,
    });
  } else if (oldStatus !== status) {
    void notify(existingStatusRow.requesterId, 'helpdesk.case.status_changed_user', {
      caseNumber: existingStatusRow.caseNumber,
      subject: existingStatusRow.subject,
      statusLabel: status,
      caseUrl: `/my/support/${caseId}`,
    });
  }

  revalidatePath(`/hd/cases/${caseId}`);
  revalidatePath('/hd');
  return { success: true };
}

/** Agent assigns case to agent/team */
export async function assignCase(formData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = assignCaseSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { caseId, assignedAgentId, assignedTeamId } = parsed.data;
  const now = new Date();

  const existingCase = await db
    .select({
      assignedAgentId: helpdeskCase.assignedAgentId,
      assignedTeamId: helpdeskCase.assignedTeamId,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      priority: helpdeskCase.priority,
    })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const old = existingCase[0];
  if (!old) return { success: false, error: 'Not found' };

  // Decrement old agent count, increment new agent count
  if (old.assignedAgentId && old.assignedTeamId) {
    await db.update(helpdeskTeamMember)
      .set({ activeCaseCount: sql`${helpdeskTeamMember.activeCaseCount} - 1` })
      .where(and(
        eq(helpdeskTeamMember.staffUserId, old.assignedAgentId),
        eq(helpdeskTeamMember.teamId, old.assignedTeamId)
      ));
  }

  if (assignedAgentId && assignedTeamId) {
    await db.update(helpdeskTeamMember)
      .set({ activeCaseCount: sql`${helpdeskTeamMember.activeCaseCount} + 1` })
      .where(and(
        eq(helpdeskTeamMember.staffUserId, assignedAgentId),
        eq(helpdeskTeamMember.teamId, assignedTeamId)
      ));
  }

  await db.update(helpdeskCase)
    .set({ assignedAgentId, assignedTeamId, updatedAt: now, lastActivityAt: now })
    .where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'assigned',
    actorType: 'agent',
    actorId: session.staffUserId,
    dataJson: { assignedAgentId, assignedTeamId },
  });

  // Notify the newly assigned agent
  if (assignedAgentId && assignedAgentId !== old.assignedAgentId) {
    void notify(assignedAgentId, 'helpdesk.agent.assigned', {
      caseNumber: old.caseNumber,
      subject: old.subject,
      priority: old.priority,
      caseUrl: `/hd/cases/${caseId}`,
    });
  }

  revalidatePath(`/hd/cases/${caseId}`);
  revalidatePath('/hd');
  return { success: true };
}

// NOTE: updateCasePriority and updateCaseTags live in './helpdesk-agent-cases-meta'
// — import them from there directly. Re-exports are not allowed in "use server" files.
