'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { watchlistItem, listing } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { updateEngagement } from '@/lib/actions/browsing-history-helpers';
import { toggleWatchlistSchema, togglePriceAlertSchema } from '@/lib/validations/watchlist';

interface ToggleResult {
  success: boolean;
  watching?: boolean;
  error?: string;
}

/**
 * Toggle watchlist status for a listing.
 * If watching, removes from watchlist. If not watching, adds to watchlist.
 */
export async function toggleWatchlistAction(listingId: string): Promise<ToggleResult> {
  const parsed = toggleWatchlistSchema.safeParse({ listingId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', 'Watchlist')) {
    return { success: false, error: 'Not authorized' };
  }

  // Get listing to check ownership
  const [listingRow] = await db
    .select({ ownerUserId: listing.ownerUserId })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) return { success: false, error: 'Listing not found' };
  if (listingRow.ownerUserId === session.userId) {
    return { success: false, error: 'Cannot watch your own listing' };
  }

  // Check if already watching
  const [existing] = await db
    .select({ id: watchlistItem.id })
    .from(watchlistItem)
    .where(and(eq(watchlistItem.userId, session.userId), eq(watchlistItem.listingId, listingId)))
    .limit(1);

  if (existing) {
    // Unwatch: delete the row
    await db.delete(watchlistItem).where(eq(watchlistItem.id, existing.id));
    revalidatePath(`/i/`);
    return { success: true, watching: false };
  }

  // Watch: insert with race safety
  await db
    .insert(watchlistItem)
    .values({ userId: session.userId, listingId })
    .onConflictDoNothing();

  // Track engagement (fire-and-forget)
  updateEngagement(session.userId, listingId, 'watchlist').catch(() => {});

  revalidatePath(`/i/`);
  return { success: true, watching: true };
}

interface PriceAlertResult {
  success: boolean;
  notifyPriceDrop?: boolean;
  error?: string;
}

/**
 * Toggle price drop notifications for a watched listing.
 */
export async function togglePriceAlertAction(listingId: string): Promise<PriceAlertResult> {
  const parsed = togglePriceAlertSchema.safeParse({ listingId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', 'Watchlist')) {
    return { success: false, error: 'Not authorized' };
  }

  // Get current watchlist item
  const [item] = await db
    .select({ id: watchlistItem.id, notifyPriceDrop: watchlistItem.notifyPriceDrop })
    .from(watchlistItem)
    .where(and(eq(watchlistItem.userId, session.userId), eq(watchlistItem.listingId, listingId)))
    .limit(1);

  if (!item) {
    return { success: false, error: 'Not watching this listing' };
  }

  // Toggle the notification setting
  const newValue = !item.notifyPriceDrop;
  await db
    .update(watchlistItem)
    .set({ notifyPriceDrop: newValue })
    .where(eq(watchlistItem.id, item.id));

  return { success: true, notifyPriceDrop: newValue };
}
