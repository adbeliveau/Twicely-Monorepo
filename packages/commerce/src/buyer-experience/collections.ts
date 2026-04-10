import { db } from '@twicely/db';
import { buyerCollection, buyerCollectionItem } from '@twicely/db/schema';
import { eq, and, count, desc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { CollectionInput, PaginationInput, PaginatedResult } from './types';

/**
 * Create a new buyer collection.
 * Enforces per-user collection limit from platform settings.
 */
export async function createCollection(
  userId: string,
  input: CollectionInput
): Promise<{ id: string }> {
  const maxPerUser = await getPlatformSetting<number>('buyer.collection.maxPerUser', 50);

  const [existing] = await db
    .select({ count: count() })
    .from(buyerCollection)
    .where(eq(buyerCollection.userId, userId));

  if ((existing?.count ?? 0) >= maxPerUser) {
    throw new Error('MAX_COLLECTIONS_REACHED');
  }

  const id = createId();
  await db.insert(buyerCollection).values({
    id,
    userId,
    name: input.name,
    description: input.description ?? null,
    isPublic: input.isPublic ?? false,
    itemCount: 0,
  });

  return { id };
}

/**
 * Add a listing to a collection.
 * Enforces per-collection item limit and uniqueness constraint.
 */
export async function addToCollection(
  collectionId: string,
  listingId: string
): Promise<void> {
  const maxItems = await getPlatformSetting<number>('buyer.collection.maxItemsPerCollection', 200);

  const [collection] = await db
    .select({ itemCount: buyerCollection.itemCount })
    .from(buyerCollection)
    .where(eq(buyerCollection.id, collectionId))
    .limit(1);

  if (!collection) {
    throw new Error('COLLECTION_NOT_FOUND');
  }

  if (collection.itemCount >= maxItems) {
    throw new Error('MAX_ITEMS_REACHED');
  }

  await db.insert(buyerCollectionItem).values({
    id: createId(),
    collectionId,
    listingId,
  });

  // Increment item count
  await db
    .update(buyerCollection)
    .set({
      itemCount: sql`${buyerCollection.itemCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(buyerCollection.id, collectionId));
}

/**
 * Remove a listing from a collection.
 */
export async function removeFromCollection(
  collectionId: string,
  listingId: string
): Promise<void> {
  const deleted = await db
    .delete(buyerCollectionItem)
    .where(
      and(
        eq(buyerCollectionItem.collectionId, collectionId),
        eq(buyerCollectionItem.listingId, listingId)
      )
    )
    .returning({ id: buyerCollectionItem.id });

  if (deleted.length > 0) {
    await db
      .update(buyerCollection)
      .set({
        itemCount: sql`GREATEST(${buyerCollection.itemCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(buyerCollection.id, collectionId));
  }
}

/**
 * Get all collections for a user.
 */
export async function getCollections(
  userId: string
): Promise<Array<{ id: string; name: string; description: string | null; isPublic: boolean; itemCount: number; createdAt: Date }>> {
  return db
    .select({
      id: buyerCollection.id,
      name: buyerCollection.name,
      description: buyerCollection.description,
      isPublic: buyerCollection.isPublic,
      itemCount: buyerCollection.itemCount,
      createdAt: buyerCollection.createdAt,
    })
    .from(buyerCollection)
    .where(eq(buyerCollection.userId, userId))
    .orderBy(desc(buyerCollection.createdAt));
}

/**
 * Get items in a collection with pagination.
 */
export async function getCollectionItems(
  collectionId: string,
  pagination: PaginationInput = {}
): Promise<PaginatedResult<{ id: string; listingId: string; addedAt: Date }>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(buyerCollectionItem)
    .where(eq(buyerCollectionItem.collectionId, collectionId));

  const items = await db
    .select({
      id: buyerCollectionItem.id,
      listingId: buyerCollectionItem.listingId,
      addedAt: buyerCollectionItem.addedAt,
    })
    .from(buyerCollectionItem)
    .where(eq(buyerCollectionItem.collectionId, collectionId))
    .orderBy(desc(buyerCollectionItem.addedAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items,
    total: totalResult?.count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Delete a collection and all its items (cascade).
 */
export async function deleteCollection(collectionId: string): Promise<void> {
  await db
    .delete(buyerCollection)
    .where(eq(buyerCollection.id, collectionId));
}
