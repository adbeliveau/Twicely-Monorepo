'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { helpdeskCase, caseMessage, caseEvent } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  createCaseSchema,
  createCaseMessageSchema,
} from '@/lib/validations/helpdesk';
import { generateCaseNumber } from '@/lib/helpdesk/case-number';
import { evaluateRoutingRules } from '@/lib/helpdesk/routing';
import { calculateSlaDue } from '@/lib/helpdesk/sla';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { notify } from '@twicely/notifications/service';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/** User-initiated case creation via /h/contact */
export async function createCase(
  formData: unknown
): Promise<ActionResult<{ caseNumber: string }>> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('create', 'HelpdeskCase')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createCaseSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const data = parsed.data;
  const now = new Date();

  const routingResult = await evaluateRoutingRules({
    type: data.type,
    priority: 'NORMAL',
    channel: 'WEB',
    subject: data.subject,
    requesterType: 'user',
  });

  const slaDates = await calculateSlaDue(routingResult.priority, now);
  const caseNumber = await generateCaseNumber();

  const insertedCases = await db.insert(helpdeskCase).values({
    caseNumber,
    type: data.type,
    channel: 'WEB',
    subject: data.subject,
    description: data.description,
    status: 'NEW',
    priority: routingResult.priority,
    requesterId: session.userId,
    requesterType: 'user',
    assignedTeamId: routingResult.assignedTeamId,
    assignedAgentId: routingResult.assignedAgentId,
    orderId: data.orderId ?? null,
    listingId: data.listingId ?? null,
    category: routingResult.category,
    tags: routingResult.tags,
    slaFirstResponseDueAt: slaDates.firstResponseDue,
    slaResolutionDueAt: slaDates.resolutionDue,
    lastActivityAt: now,
  }).returning({ id: helpdeskCase.id, caseNumber: helpdeskCase.caseNumber });

  const newCase = insertedCases[0];
  if (!newCase) return { success: false, error: 'Failed to create case' };

  await db.insert(caseMessage).values({
    caseId: newCase.id,
    senderType: 'user',
    senderId: session.userId,
    direction: 'INBOUND',
    body: data.description,
    attachments: data.attachments ? JSON.stringify(data.attachments) : sql`'[]'`,
  });

  await db.insert(caseEvent).values({
    caseId: newCase.id,
    eventType: 'created',
    actorType: 'user',
    actorId: session.userId,
    dataJson: { channel: 'WEB', type: data.type },
  });

  void notify(session.userId, 'helpdesk.case.created', { caseNumber: newCase.caseNumber });
  void notify(session.userId, 'helpdesk.case.auto_reply', {
    subject: data.subject,
    caseNumber: newCase.caseNumber,
    suggestedArticles: '',
  });

  revalidatePath('/my/support');
  return { success: true, data: { caseNumber: newCase.caseNumber } };
}

/** User replies to their own case */
export async function addUserReply(
  caseId: string,
  formData: unknown
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('update', sub('HelpdeskCase', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = createCaseMessageSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const existingCase = await db
    .select({ id: helpdeskCase.id, requesterId: helpdeskCase.requesterId, status: helpdeskCase.status })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const caseRecord = existingCase[0];
  if (!caseRecord) return { success: false, error: 'Not found' };
  if (caseRecord.requesterId !== session.userId) return { success: false, error: 'Not found' };

  const now = new Date();

  await db.insert(caseMessage).values({
    caseId,
    senderType: 'user',
    senderId: session.userId,
    direction: 'INBOUND',
    body: parsed.data.body,
    attachments: parsed.data.attachments ? JSON.stringify(parsed.data.attachments) : sql`'[]'`,
  });

  const newStatus = caseRecord.status === 'PENDING_USER' ? 'OPEN' : caseRecord.status;
  await db.update(helpdeskCase)
    .set({ status: newStatus, updatedAt: now, lastActivityAt: now })
    .where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'user_replied',
    actorType: 'user',
    actorId: session.userId,
    dataJson: {},
  });

  revalidatePath(`/my/support/${caseId}`);
  return { success: true };
}

/** User reopens a resolved case within the reopen window */
export async function reopenCase(caseId: string): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('update', sub('HelpdeskCase', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const existingCase = await db
    .select({
      requesterId: helpdeskCase.requesterId,
      status: helpdeskCase.status,
      resolvedAt: helpdeskCase.resolvedAt,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      assignedAgentId: helpdeskCase.assignedAgentId,
    })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const caseRecord = existingCase[0];
  if (!caseRecord) return { success: false, error: 'Not found' };

  if (caseRecord.requesterId !== session.userId) return { success: false, error: 'Not found' };
  if (caseRecord.status !== 'RESOLVED') return { success: false, error: 'Case is not in RESOLVED status' };

  const windowDays = await getPlatformSetting<number>('helpdesk.reopen.windowDays', 7);
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const resolvedAt = caseRecord.resolvedAt ? new Date(caseRecord.resolvedAt) : null;

  if (!resolvedAt || Date.now() - resolvedAt.getTime() > windowMs) {
    return { success: false, error: 'Reopen window has expired' };
  }

  const now = new Date();
  await db.update(helpdeskCase)
    .set({ status: 'OPEN', reopenedAt: now, updatedAt: now, lastActivityAt: now })
    .where(eq(helpdeskCase.id, caseId));

  await db.insert(caseEvent).values({
    caseId,
    eventType: 'reopened',
    actorType: 'user',
    actorId: session.userId,
    dataJson: {},
  });

  // Notify assigned agent that the case was reopened
  if (caseRecord.assignedAgentId) {
    void notify(caseRecord.assignedAgentId, 'helpdesk.case.reopened', {
      subject: caseRecord.subject,
      caseNumber: caseRecord.caseNumber,
    });
  }

  revalidatePath(`/my/support/${caseId}`);
  return { success: true };
}
