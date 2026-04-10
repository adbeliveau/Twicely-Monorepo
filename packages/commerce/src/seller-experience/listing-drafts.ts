import { db } from '@twicely/db';
import { listingDraft } from '@twicely/db/schema';
import { eq, and, desc, isNotNull, lte, count } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { DraftInput } from './types';

interface DraftRow {
  id: string;
  sellerId: string;
  listingId: string | null;
  draftData: unknown;
  autoSavedAt: Date;
  scheduledPublishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Save or update a listing draft (auto-save).
 */
export async function saveDraft(
  sellerId: string,
  data: DraftInput
): Promise<{ id: string }> {
  const id = createId();
  const now = new Date();

  await db.insert(listingDraft).values({
    id,
    sellerId,
    listingId: data.listingId ?? null,
    draftData: data.draftData,
    autoSavedAt: now,
    scheduledPublishAt: data.scheduledPublishAt ?? null,
  });

  return { id };
}

/**
 * Get all drafts for a seller.
 */
export async function getDrafts(sellerId: string): Promise<DraftRow[]> {
  const rows = await db
    .select({
      id: listingDraft.id,
      sellerId: listingDraft.sellerId,
      listingId: listingDraft.listingId,
      draftData: listingDraft.draftData,
      autoSavedAt: listingDraft.autoSavedAt,
      scheduledPublishAt: listingDraft.scheduledPublishAt,
      createdAt: listingDraft.createdAt,
      updatedAt: listingDraft.updatedAt,
    })
    .from(listingDraft)
    .where(eq(listingDraft.sellerId, sellerId))
    .orderBy(desc(listingDraft.updatedAt));

  return rows as unknown as DraftRow[];
}

/**
 * Get a single draft by ID.
 */
export async function getDraft(id: string): Promise<DraftRow | null> {
  const [row] = await db
    .select({
      id: listingDraft.id,
      sellerId: listingDraft.sellerId,
      listingId: listingDraft.listingId,
      draftData: listingDraft.draftData,
      autoSavedAt: listingDraft.autoSavedAt,
      scheduledPublishAt: listingDraft.scheduledPublishAt,
      createdAt: listingDraft.createdAt,
      updatedAt: listingDraft.updatedAt,
    })
    .from(listingDraft)
    .where(eq(listingDraft.id, id))
    .limit(1);

  return (row as unknown as DraftRow) ?? null;
}

/**
 * Delete a draft.
 */
export async function deleteDraft(id: string): Promise<void> {
  await db
    .delete(listingDraft)
    .where(eq(listingDraft.id, id));
}

/**
 * Mark a draft as published (deletes the draft after use).
 * In a real implementation, this would create/update the listing first.
 */
export async function publishDraft(id: string): Promise<void> {
  const [draft] = await db
    .select({ id: listingDraft.id })
    .from(listingDraft)
    .where(eq(listingDraft.id, id))
    .limit(1);

  if (!draft) {
    throw new Error('DRAFT_NOT_FOUND');
  }

  // In production, listing creation/update would happen here.
  // Then remove the draft.
  await db
    .delete(listingDraft)
    .where(eq(listingDraft.id, id));
}

/**
 * Schedule a draft for future publication.
 */
export async function schedulePublish(id: string, publishAt: Date): Promise<void> {
  await db
    .update(listingDraft)
    .set({
      scheduledPublishAt: publishAt,
      updatedAt: new Date(),
    })
    .where(eq(listingDraft.id, id));
}

/**
 * Get all drafts that are scheduled for publication (due now or overdue).
 * Used by a cron job to process scheduled publishes.
 */
export async function getScheduledDrafts(): Promise<DraftRow[]> {
  const now = new Date();

  const rows = await db
    .select({
      id: listingDraft.id,
      sellerId: listingDraft.sellerId,
      listingId: listingDraft.listingId,
      draftData: listingDraft.draftData,
      autoSavedAt: listingDraft.autoSavedAt,
      scheduledPublishAt: listingDraft.scheduledPublishAt,
      createdAt: listingDraft.createdAt,
      updatedAt: listingDraft.updatedAt,
    })
    .from(listingDraft)
    .where(
      and(
        isNotNull(listingDraft.scheduledPublishAt),
        lte(listingDraft.scheduledPublishAt, now)
      )
    )
    .orderBy(listingDraft.scheduledPublishAt);

  return rows as unknown as DraftRow[];
}
