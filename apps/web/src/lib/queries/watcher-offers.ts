import { db } from '@twicely/db';
import { watcherOffer, listing, watchlistItem } from '@twicely/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export interface ActiveWatcherOffer {
  id: string;
  listingId: string;
  sellerId: string;
  discountedPriceCents: number;
  expiresAt: Date;
  watchersNotifiedCount: number;
  createdAt: Date;
}

/**
 * Get the active watcher offer for a listing (if any).
 */
export async function getActiveWatcherOffer(listingId: string): Promise<ActiveWatcherOffer | null> {
  const [offer] = await db
    .select({
      id: watcherOffer.id,
      listingId: watcherOffer.listingId,
      sellerId: watcherOffer.sellerId,
      discountedPriceCents: watcherOffer.discountedPriceCents,
      expiresAt: watcherOffer.expiresAt,
      watchersNotifiedCount: watcherOffer.watchersNotifiedCount,
      createdAt: watcherOffer.createdAt,
    })
    .from(watcherOffer)
    .where(and(eq(watcherOffer.listingId, listingId), gt(watcherOffer.expiresAt, new Date())))
    .limit(1);

  return offer ?? null;
}

export interface WatcherOfferForBuyer {
  offer: ActiveWatcherOffer;
  isWatcher: boolean;
  listingPriceCents: number;
}

/**
 * Get the active watcher offer for a listing, plus whether the user is watching it.
 * Returns null if no active watcher offer exists.
 */
export async function getWatcherOfferForBuyer(
  listingId: string,
  userId: string | null
): Promise<WatcherOfferForBuyer | null> {
  // Get active offer
  const offer = await getActiveWatcherOffer(listingId);
  if (!offer) return null;

  // Get current listing price
  const [lst] = await db
    .select({ priceCents: listing.priceCents })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!lst || !lst.priceCents) return null;

  // Check if user is watching (only if logged in)
  let isWatcher = false;
  if (userId) {
    const [watch] = await db
      .select({ id: watchlistItem.id })
      .from(watchlistItem)
      .where(and(eq(watchlistItem.userId, userId), eq(watchlistItem.listingId, listingId)))
      .limit(1);
    isWatcher = !!watch;
  }

  return {
    offer,
    isWatcher,
    listingPriceCents: lst.priceCents,
  };
}

/**
 * Get watcher offer history for a listing (for seller dashboard).
 */
export async function getWatcherOfferHistory(listingId: string): Promise<ActiveWatcherOffer[]> {
  const offers = await db
    .select({
      id: watcherOffer.id,
      listingId: watcherOffer.listingId,
      sellerId: watcherOffer.sellerId,
      discountedPriceCents: watcherOffer.discountedPriceCents,
      expiresAt: watcherOffer.expiresAt,
      watchersNotifiedCount: watcherOffer.watchersNotifiedCount,
      createdAt: watcherOffer.createdAt,
    })
    .from(watcherOffer)
    .where(eq(watcherOffer.listingId, listingId))
    .orderBy(watcherOffer.createdAt);

  return offers;
}
