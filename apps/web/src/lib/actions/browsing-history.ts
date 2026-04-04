'use server';

import { db } from '@twicely/db';
import { browsingHistory, listing } from '@twicely/db/schema';
import { authorize } from '@twicely/casl';
import { eq, and, count, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const recordViewSchema = z.object({
  listingId: z.string().cuid2(),
  options: z.object({
    sourceType: z.enum(['search', 'category', 'recommendation', 'alert', 'direct']).optional(),
    searchQuery: z.string().max(200).optional(),
  }).strict().optional(),
}).strict();

const removeHistorySchema = z.object({
  listingId: z.string().cuid2(),
}).strict();


interface RecordViewResult {
  success: boolean;
  error?: string;
}

type SourceType = 'search' | 'category' | 'recommendation' | 'alert' | 'direct';

interface RecordViewOptions {
  sourceType?: SourceType;
  searchQuery?: string;
}

/**
 * Record a listing view for the current user's browsing history.
 * Uses FIFO to maintain max 50 items per user.
 * Skips recording for the listing owner.
 * Upserts on (userId, listingId) — increments viewCount on revisit.
 */
export async function recordViewAction(
  listingId: string,
  options?: RecordViewOptions
): Promise<RecordViewResult> {
  const { session, ability } = await authorize();

  // Silent no-op for logged out users
  if (!session) {
    return { success: true };
  }

  if (!ability.can('create', 'BrowsingHistory')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = recordViewSchema.safeParse({ listingId, options });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Get listing details (check ownership + get categoryId/sellerId)
  const [listingRow] = await db
    .select({
      ownerUserId: listing.ownerUserId,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  if (listingRow.ownerUserId === session.userId) {
    // Silent no-op for viewing own listing
    return { success: true };
  }

  // Upsert: insert if new, update viewCount/timestamps if exists
  await db
    .insert(browsingHistory)
    .values({
      userId: session.userId,
      listingId,
      categoryId: listingRow.categoryId,
      sellerId: listingRow.ownerUserId,
      sourceType: options?.sourceType,
      searchQuery: options?.searchQuery,
    })
    .onConflictDoUpdate({
      target: [browsingHistory.userId, browsingHistory.listingId],
      set: {
        viewCount: sql`${browsingHistory.viewCount} + 1`,
        lastViewedAt: new Date(),
        // Update source only if provided (don't overwrite with null)
        ...(options?.sourceType && { sourceType: options.sourceType }),
        ...(options?.searchQuery && { searchQuery: options.searchQuery }),
      },
    });

  // FIFO cleanup: delete oldest if over limit
  const [countResult] = await db
    .select({ count: count() })
    .from(browsingHistory)
    .where(eq(browsingHistory.userId, session.userId));

  const historyCount = countResult?.count ?? 0;

  const maxHistoryItems = await getPlatformSetting<number>('discovery.browsingHistory.maxItems', 50);
  if (historyCount > maxHistoryItems) {
    const excess = historyCount - maxHistoryItems;
    const oldestItems = await db
      .select({ id: browsingHistory.id })
      .from(browsingHistory)
      .where(eq(browsingHistory.userId, session.userId))
      .orderBy(browsingHistory.firstViewedAt)
      .limit(excess);

    const ids = oldestItems.map((i) => i.id);
    await db.delete(browsingHistory).where(inArray(browsingHistory.id, ids));
  }

  return { success: true };
}

/**
 * Clear all browsing history for the current user.
 */
export async function clearBrowsingHistoryAction(): Promise<RecordViewResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('delete', 'BrowsingHistory')) {
    return { success: false, error: 'Not authorized' };
  }

  await db.delete(browsingHistory).where(eq(browsingHistory.userId, session.userId));

  return { success: true };
}

/**
 * Remove a single item from the current user's browsing history.
 */
export async function removeFromHistoryAction(listingId: string): Promise<RecordViewResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('delete', 'BrowsingHistory')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = removeHistorySchema.safeParse({ listingId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await db
    .delete(browsingHistory)
    .where(
      and(eq(browsingHistory.userId, session.userId), eq(browsingHistory.listingId, listingId))
    );

  return { success: true };
}
