'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { helpdeskCase, caseMessage, caseEvent, helpdeskTeamMember } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  agentReplySchema,
  updateCaseStatusSchema,
  assignCaseSchema,
  updateCasePrioritySchema,
  updateCaseTagsSchema,
} from '@/lib/validations/helpdesk';
import { calculateSlaDue } from '@/lib/helpdesk/sla';
import { notifyCaseWatchers } from '@/lib/helpdesk/notify-watchers';
import { notify } from '@twicely/notifications/service';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
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
    .select({ id: helpdeskCase.id, firstResponseAt: helpdeskCase.firstResponseAt, requesterId: helpdeskCase.requesterId, status: helpdeskCase.status })
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
    .select({ id: helpdeskCase.id, status: helpdeskCase.status })
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
    .select({ assignedAgentId: helpdeskCase.assignedAgentId, assignedTeamId: helpdeskCase.assignedTeamId })
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

  revalidatePath(`/hd/cases/${caseId}`);
  revalidatePath('/hd');
  return { success: true };
}

/** Agent changes case priority */
export async function updateCasePriority(formData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = updateCasePrioritySchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { caseId, priority } = parsed.data;
  const now = new Date();

  const existingCase = await db
    .select({ id: helpdeskCase.id, priority: helpdeskCase.priority, createdAt: helpdeskCase.createdAt })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const priorityCase = existingCase[0];
  if (!priorityCase) return { success: false, error: 'Not found' };
  const oldPriority = priorityCase.priority;

  const slaDates = await calculateSlaDue(priority, priorityCase.createdAt);

  await db.update(helpdeskCase)
    .set({
      priority,
      slaFirstResponseDueAt: slaDates.firstResponseDue,
      slaResolutionDueAt: slaDates.resolutionDue,
      updatedAt: now,
      lastActivityAt: now,
    })
    .where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'priority_changed',
    actorType: 'agent',
    actorId: session.staffUserId,
    dataJson: { oldPriority, newPriority: priority },
  });

  revalidatePath(`/hd/cases/${caseId}`);
  return { success: true };
}

/** Agent updates case tags */
export async function updateCaseTags(formData: unknown): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = updateCaseTagsSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { caseId, tags } = parsed.data;
  const now = new Date();

  await db.update(helpdeskCase)
    .set({ tags, updatedAt: now, lastActivityAt: now })
    .where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'tags_changed',
    actorType: 'agent',
    actorId: session.staffUserId,
    dataJson: { tags },
  });

  revalidatePath(`/hd/cases/${caseId}`);
  return { success: true };
}
