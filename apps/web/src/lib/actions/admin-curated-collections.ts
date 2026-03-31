'use server';

/**
 * Admin Curated Collections Actions (G3.10)
 * Create, update, delete collections; add/remove/reorder items — all audited.
 */

import { db } from '@twicely/db';
import { curatedCollection, curatedCollectionItem, listing, auditEvent } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { slugify } from '@twicely/utils/format';
import { searchListingsForCollection } from '@/lib/queries/admin-curated-collections';
import { zodId } from '@/lib/validation/schemas';
import {
  createCollectionSchema,
  updateCollectionSchema,
  deleteCollectionSchema,
  addCollectionItemSchema,
  removeCollectionItemSchema,
  reorderCollectionItemsSchema,
} from '@/lib/validations/curated-collections';

async function resolveUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  const existing = await db
    .select({ id: curatedCollection.id })
    .from(curatedCollection)
    .where(eq(curatedCollection.slug, baseSlug));
  if (existing.length === 0 || (excludeId && existing[0]?.id === excludeId)) {
    return baseSlug;
  }
  return `${baseSlug}-${createId().slice(0, 8)}`;
}

export async function createCollectionAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = createCollectionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { title, description, coverImageUrl, startDate, endDate, sortOrder } = parsed.data;
  const baseSlug = slugify(title);
  const slug = await resolveUniqueSlug(baseSlug);

  const id = createId();
  await db.insert(curatedCollection).values({
    id,
    title,
    slug,
    description: description ?? null,
    coverImageUrl: coverImageUrl ?? null,
    isPublished: false,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    sortOrder: sortOrder,
    curatedBy: session.staffUserId,
  });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_CURATED_COLLECTION',
    subject: 'CuratedCollection',
    subjectId: id,
    severity: 'MEDIUM',
    detailsJson: { title },
  });

  revalidatePath('/mod/collections');
  return { success: true, collectionId: id };
}

export async function updateCollectionAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateCollectionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { collectionId, title, description, coverImageUrl, isPublished, startDate, endDate, sortOrder } = parsed.data;

  const existing = await db
    .select({ id: curatedCollection.id })
    .from(curatedCollection)
    .where(eq(curatedCollection.id, collectionId));
  if (existing.length === 0) return { error: 'Not found' };

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) {
    updateFields.title = title;
    const baseSlug = slugify(title);
    updateFields.slug = await resolveUniqueSlug(baseSlug, collectionId);
  }
  if (description !== undefined) updateFields.description = description;
  if (coverImageUrl !== undefined) updateFields.coverImageUrl = coverImageUrl;
  if (isPublished !== undefined) updateFields.isPublished = isPublished;
  if (startDate !== undefined) updateFields.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updateFields.endDate = endDate ? new Date(endDate) : null;
  if (sortOrder !== undefined) updateFields.sortOrder = sortOrder;

  await db
    .update(curatedCollection)
    .set(updateFields)
    .where(eq(curatedCollection.id, collectionId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_CURATED_COLLECTION',
    subject: 'CuratedCollection',
    subjectId: collectionId,
    severity: 'MEDIUM',
    detailsJson: {},
  });

  revalidatePath('/mod/collections');
  revalidatePath('/mod/collections/' + collectionId);
  return { success: true };
}

export async function deleteCollectionAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = deleteCollectionSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { collectionId } = parsed.data;
  const existing = await db
    .select({ id: curatedCollection.id })
    .from(curatedCollection)
    .where(eq(curatedCollection.id, collectionId));
  if (existing.length === 0) return { error: 'Not found' };

  await db.delete(curatedCollection).where(eq(curatedCollection.id, collectionId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'DELETE_CURATED_COLLECTION',
    subject: 'CuratedCollection',
    subjectId: collectionId,
    severity: 'HIGH',
    detailsJson: {},
  });

  revalidatePath('/mod/collections');
  return { success: true };
}

export async function addCollectionItemAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = addCollectionItemSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { collectionId, listingId, sortOrder } = parsed.data;

  const col = await db
    .select({ id: curatedCollection.id })
    .from(curatedCollection)
    .where(eq(curatedCollection.id, collectionId));
  if (col.length === 0) return { error: 'Not found' };

  const lst = await db
    .select({ id: listing.id, status: listing.status })
    .from(listing)
    .where(eq(listing.id, listingId));
  if (lst.length === 0) return { error: 'Listing not found' };
  if (lst[0]!.status !== 'ACTIVE') return { error: 'Listing is not active' };

  const duplicate = await db
    .select({ id: curatedCollectionItem.id })
    .from(curatedCollectionItem)
    .where(and(eq(curatedCollectionItem.collectionId, collectionId), eq(curatedCollectionItem.listingId, listingId)));
  if (duplicate.length > 0) return { error: 'Listing already in collection' };

  await db.insert(curatedCollectionItem).values({
    collectionId,
    listingId,
    sortOrder,
    addedBy: session.staffUserId,
  });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ADD_COLLECTION_ITEM',
    subject: 'CuratedCollection',
    subjectId: collectionId,
    severity: 'LOW',
    detailsJson: { listingId },
  });

  revalidatePath('/mod/collections/' + collectionId);
  return { success: true };
}

export async function removeCollectionItemAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = removeCollectionItemSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { collectionId, listingId } = parsed.data;

  await db
    .delete(curatedCollectionItem)
    .where(and(eq(curatedCollectionItem.collectionId, collectionId), eq(curatedCollectionItem.listingId, listingId)));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'REMOVE_COLLECTION_ITEM',
    subject: 'CuratedCollection',
    subjectId: collectionId,
    severity: 'LOW',
    detailsJson: { listingId },
  });

  revalidatePath('/mod/collections/' + collectionId);
  return { success: true };
}

export async function reorderCollectionItemsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = reorderCollectionItemsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { collectionId, items } = parsed.data;

  await db.transaction(async (tx) => {
    await Promise.all(
      items.map((item) =>
        tx
          .update(curatedCollectionItem)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(curatedCollectionItem.collectionId, collectionId),
              eq(curatedCollectionItem.listingId, item.listingId),
            ),
          ),
      ),
    );

    await tx.insert(auditEvent).values({
      actorType: 'STAFF',
      actorId: session.staffUserId,
      action: 'REORDER_COLLECTION_ITEMS',
      subject: 'CuratedCollection',
      subjectId: collectionId,
      severity: 'LOW',
      detailsJson: {},
    });
  });

  revalidatePath('/mod/collections/' + collectionId);
  return { success: true };
}

const searchListingsSchema = z.object({
  query: z.string().min(1).max(200),
  excludeListingIds: z.array(zodId).default([]),
}).strict();

export async function searchListingsForCollectionAction(input: unknown) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'CuratedCollection')) {
    return { error: 'Forbidden' };
  }

  const parsed = searchListingsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const listings = await searchListingsForCollection(parsed.data.query, parsed.data.excludeListingIds);
  return { success: true, listings };
}
