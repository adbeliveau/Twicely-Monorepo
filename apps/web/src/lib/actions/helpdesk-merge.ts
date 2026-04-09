'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { helpdeskCase, caseMessage, caseEvent, caseWatcher } from '@twicely/db/schema';
import { eq, and, count, not } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { searchCasesForMerge } from '@/lib/queries/helpdesk-merge-search';
import { mergeCasesSchema } from '@/lib/validations/helpdesk';

interface ActionResult {
  success: boolean;
  error?: string;
}

export interface MergeSearchResult {
  id: string;
  caseNumber: string;
  subject: string;
  requesterEmail: string | null;
  status: string;
}

/**
 * Server action: searches open cases as merge targets.
 * Wraps the query so client components don't import db directly.
 */
export async function searchCasesForMergeAction(
  query: string,
  excludeCaseId: string
): Promise<MergeSearchResult[]> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) return [];
  return searchCasesForMerge(query, excludeCaseId);
}

/**
 * Merges source case into target case.
 * Per canonical §28.2–28.3:
 * 1. All messages/events/watchers/tags/commerce links copied from source to target.
 * 2. Source case is CLOSED with mergedIntoCaseId set.
 * 3. Events created on both cases.
 */
export async function mergeCases(formData: unknown): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  const parsed = mergeCasesSchema.safeParse(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const { sourceCaseId, targetCaseId } = parsed.data;

  // Step 5: source !== target
  if (sourceCaseId === targetCaseId) {
    return { success: false, error: 'Cannot merge a case into itself' };
  }

  // Step 3-4: Fetch both cases in parallel
  const [sourceCases, targetCases] = await Promise.all([
    db.select().from(helpdeskCase).where(eq(helpdeskCase.id, sourceCaseId)).limit(1),
    db.select().from(helpdeskCase).where(eq(helpdeskCase.id, targetCaseId)).limit(1),
  ]);

  const sourceCase = sourceCases[0];
  const targetCase = targetCases[0];

  if (!sourceCase) return { success: false, error: 'Source case not found' };
  if (!targetCase) return { success: false, error: 'Target case not found' };

  // Step 6: target must not be CLOSED
  if (targetCase.status === 'CLOSED') {
    return { success: false, error: 'Cannot merge into a closed case' };
  }

  // Step 7: source must not already be merged
  if (sourceCase.mergedIntoCaseId !== null) {
    return { success: false, error: 'Source case has already been merged' };
  }

  // Step 8: target must have fewer than 5 merged sources
  const mergeCountResult = await db
    .select({ count: count() })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.mergedIntoCaseId, targetCaseId));

  const mergeCount = mergeCountResult[0]?.count ?? 0;
  if (mergeCount >= 5) {
    return { success: false, error: 'Target case already has 5 merged sources (maximum)' };
  }

  const now = new Date();

  // Step 9: Copy all messages from source to target (set fromMergedCaseId)
  const sourceMessages = await db
    .select()
    .from(caseMessage)
    .where(eq(caseMessage.caseId, sourceCaseId));

  if (sourceMessages.length > 0) {
    const messageCopies = sourceMessages.map((m) => ({
      caseId: targetCaseId,
      senderType: m.senderType,
      senderId: m.senderId,
      senderName: m.senderName,
      direction: m.direction,
      body: m.body,
      bodyHtml: m.bodyHtml,
      attachments: m.attachments,
      deliveryStatus: m.deliveryStatus,
      emailMessageId: m.emailMessageId,
      fromMergedCaseId: sourceCaseId,
      createdAt: m.createdAt,
    }));
    await db.insert(caseMessage).values(messageCopies);
  }

  // Step 10: Copy all events from source to target (set fromMergedCaseId)
  const sourceEvents = await db
    .select()
    .from(caseEvent)
    .where(eq(caseEvent.caseId, sourceCaseId));

  if (sourceEvents.length > 0) {
    const eventCopies = sourceEvents.map((e) => ({
      caseId: targetCaseId,
      eventType: e.eventType,
      actorType: e.actorType,
      actorId: e.actorId,
      dataJson: e.dataJson,
      fromMergedCaseId: sourceCaseId,
      createdAt: e.createdAt,
    }));
    await db.insert(caseEvent).values(eventCopies);
  }

  // Step 11: Copy watchers from source to target (skip duplicates)
  const [sourceWatchers, targetWatchers] = await Promise.all([
    db.select().from(caseWatcher).where(eq(caseWatcher.caseId, sourceCaseId)),
    db.select().from(caseWatcher).where(eq(caseWatcher.caseId, targetCaseId)),
  ]);

  const existingWatcherStaffIds = new Set(targetWatchers.map((w) => w.staffUserId));
  const newWatchers = sourceWatchers.filter((w) => !existingWatcherStaffIds.has(w.staffUserId));

  if (newWatchers.length > 0) {
    await db.insert(caseWatcher).values(
      newWatchers.map((w) => ({
        caseId: targetCaseId,
        staffUserId: w.staffUserId,
      }))
    );
  }

  // Step 12: Union tags from source into target
  const sourceTags = sourceCase.tags ?? [];
  const targetTags = targetCase.tags ?? [];
  const mergedTags = Array.from(new Set([...targetTags, ...sourceTags]));

  // Step 13: Union commerce links from source into target (only if target is null)
  const commerceUpdate: Record<string, string | null> = {};
  if (!targetCase.orderId && sourceCase.orderId) commerceUpdate.orderId = sourceCase.orderId;
  if (!targetCase.listingId && sourceCase.listingId) commerceUpdate.listingId = sourceCase.listingId;
  if (!targetCase.sellerId && sourceCase.sellerId) commerceUpdate.sellerId = sourceCase.sellerId;
  if (!targetCase.payoutId && sourceCase.payoutId) commerceUpdate.payoutId = sourceCase.payoutId;
  if (!targetCase.disputeCaseId && sourceCase.disputeCaseId) commerceUpdate.disputeCaseId = sourceCase.disputeCaseId;
  if (!targetCase.returnRequestId && sourceCase.returnRequestId) commerceUpdate.returnRequestId = sourceCase.returnRequestId;

  await db.update(helpdeskCase)
    .set({ tags: mergedTags, updatedAt: now, lastActivityAt: now, ...commerceUpdate })
    .where(eq(helpdeskCase.id, targetCaseId));

  // Step 14: Close source case, set mergedIntoCaseId
  await db.update(helpdeskCase)
    .set({
      status: 'CLOSED',
      mergedIntoCaseId: targetCaseId,
      closedAt: now,
      updatedAt: now,
      lastActivityAt: now,
    })
    .where(and(eq(helpdeskCase.id, sourceCaseId), not(eq(helpdeskCase.status, 'CLOSED'))));

  // Step 15: Create merged_into event on source
  await db.insert(caseEvent).values({
    caseId: sourceCaseId,
    eventType: 'merged_into',
    actorType: 'agent',
    actorId: session.staffUserId,
    dataJson: { targetCaseId },
  });

  // Step 16: Create merged_from event on target
  await db.insert(caseEvent).values({
    caseId: targetCaseId,
    eventType: 'merged_from',
    actorType: 'agent',
    actorId: session.staffUserId,
    dataJson: { sourceCaseId, sourceCaseNumber: sourceCase.caseNumber },
  });

  // Step 17: Revalidate both case paths
  revalidatePath(`/hd/cases/${sourceCaseId}`);
  revalidatePath(`/hd/cases/${targetCaseId}`);

  return { success: true };
}
