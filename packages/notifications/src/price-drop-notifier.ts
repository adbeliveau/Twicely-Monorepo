import { db } from '@twicely/db';
import { watchlistItem, listing, user } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { notify } from './service';
import { formatPrice } from '@twicely/utils/format';
import { logger } from '@twicely/logger';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

/**
 * Notify all watchers with notifyPriceDrop=true when a listing price drops.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyPriceDropWatchers(
  listingId: string,
  oldPriceCents: number,
  newPriceCents: number
): Promise<void> {
  // Only notify if price actually dropped
  if (newPriceCents >= oldPriceCents) return;

  try {
    // Get listing details
    const [listingRow] = await db
      .select({ title: listing.title, slug: listing.slug })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!listingRow) return;

    // Get all watchers with notifyPriceDrop enabled
    const watchers = await db
      .select({
        userId: watchlistItem.userId,
        userName: user.name,
      })
      .from(watchlistItem)
      .innerJoin(user, eq(user.id, watchlistItem.userId))
      .where(and(eq(watchlistItem.listingId, listingId), eq(watchlistItem.notifyPriceDrop, true)));

    // Fire-and-forget each notification
    for (const watcher of watchers) {
      notify(watcher.userId, 'watchlist.price_drop', {
        recipientName: watcher.userName ?? 'there',
        itemTitle: listingRow.title ?? 'Item',
        oldPriceFormatted: formatPrice(oldPriceCents),
        newPriceFormatted: formatPrice(newPriceCents),
        listingUrl: `${BASE_URL}/i/${listingRow.slug}`,
      }).catch(() => {});
    }
  } catch (err) {
    logger.error('[notifyPriceDropWatchers] Error:', { err });
  }
}
