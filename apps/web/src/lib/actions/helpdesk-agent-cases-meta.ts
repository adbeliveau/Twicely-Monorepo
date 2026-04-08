'use server';

/**
 * Helpdesk Agent Case Meta Actions
 * Split from helpdesk-agent-cases.ts for file-size compliance.
 * Priority and tag updates.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { helpdeskCase, caseEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  updateCasePrioritySchema,
  updateCaseTagsSchema,
} from '@/lib/validations/helpdesk';
import { calculateSlaDue } from '@/lib/helpdesk/sla';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
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
