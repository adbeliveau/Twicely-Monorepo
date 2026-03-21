'use server';

import { db } from '@twicely/db';
import { watcherOffer, listing, watchlistItem, listingOffer } from '@twicely/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { authorize } from '@twicely/casl';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import {
  createWatcherOfferSchema,
  acceptWatcherOfferSchema,
  cancelWatcherOfferSchema,
} from '@/lib/validations/watcher-offers';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

/** Format cents as USD string e.g. "$125.00" */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface WatcherOfferResult {
  success: boolean;
  error?: string;
  watcherOfferId?: string;
  watchersNotified?: number;
}

/**
 * Create a watcher offer — seller broadcasts discounted price to all watchers.
 * sellerId derived from session, NEVER from request body.
 */
export async function createWatcherOffer(params: unknown): Promise<WatcherOfferResult> {
  const parsed = createWatcherOfferSchema.safeParse(params);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('create', 'Promotion')) return { success: false, error: 'Not authorized' };
  const sellerId = session.userId;
  const { listingId, discountedPriceCents } = parsed.data;

  // 1. Verify listing exists and seller owns it
  const [lst] = await db
    .select({
      id: listing.id,
      ownerId: listing.ownerUserId,
      priceCents: listing.priceCents,
      status: listing.status,
      title: listing.title,
      slug: listing.slug,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!lst) return { success: false, error: 'Listing not found' };
  if (lst.ownerId !== sellerId) return { success: false, error: 'You do not own this listing' };
  if (lst.status !== 'ACTIVE') return { success: false, error: 'Listing is not active' };

  // 2. Verify discounted price < current price
  if (!lst.priceCents || discountedPriceCents >= lst.priceCents) {
    return { success: false, error: 'Discounted price must be less than current price' };
  }

  // 3. Check no active watcher offer exists for this listing
  const existingOffer = await getActiveWatcherOfferInternal(listingId);
  if (existingOffer) {
    return { success: false, error: 'An active watcher offer already exists for this listing' };
  }

  // 4. Get all watchers of this listing
  const watchers = await db
    .select({ userId: watchlistItem.userId })
    .from(watchlistItem)
    .where(eq(watchlistItem.listingId, listingId));

  if (watchers.length === 0) {
    return { success: false, error: 'This listing has no watchers' };
  }

  // 5. Calculate expiry
  const watcherOfferExpiryHours = await getPlatformSetting<number>('commerce.offer.watcherExpiryHours', 24);
  const expiresAt = new Date(Date.now() + watcherOfferExpiryHours * 60 * 60 * 1000);

  // 6. Insert watcher offer row
  const [newOffer] = await db.insert(watcherOffer).values({
    listingId,
    sellerId,
    discountedPriceCents,
    expiresAt,
    watchersNotifiedCount: watchers.length,
  }).returning();

  if (!newOffer) {
    return { success: false, error: 'Failed to create watcher offer' };
  }

  // 7. Notify each watcher (fire-and-forget)
  const listingUrl = `${BASE_URL}/i/${lst.slug ?? listingId}`;
  for (const watcher of watchers) {
    notify(watcher.userId, 'watchlist.watcher_offer', {
      itemTitle: lst.title ?? 'Item',
      originalPriceFormatted: formatCents(lst.priceCents),
      discountedPriceFormatted: formatCents(discountedPriceCents),
      listingUrl,
      watcherOfferId: newOffer.id,
    }).catch((err) => logger.error('[watcher-offer] notification failed', { error: String(err) }));
  }

  return {
    success: true,
    watcherOfferId: newOffer.id,
    watchersNotified: watchers.length,
  };
}

interface AcceptWatcherOfferResult {
  success: boolean;
  error?: string;
  offerId?: string;
}

/**
 * Accept a watcher offer — creates a standard offer at the discounted price.
 * Buyer must be watching the listing. buyerId derived from session.
 */
export async function acceptWatcherOffer(params: unknown): Promise<AcceptWatcherOfferResult> {
  const parsed = acceptWatcherOfferSchema.safeParse(params);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('create', 'Offer')) return { success: false, error: 'Not authorized' };
  const buyerId = session.userId;
  const { watcherOfferId, shippingAddressId } = parsed.data;

  // 1. Fetch watcher offer
  const [offer] = await db
    .select({
      id: watcherOffer.id,
      listingId: watcherOffer.listingId,
      sellerId: watcherOffer.sellerId,
      discountedPriceCents: watcherOffer.discountedPriceCents,
      expiresAt: watcherOffer.expiresAt,
    })
    .from(watcherOffer)
    .where(eq(watcherOffer.id, watcherOfferId))
    .limit(1);

  if (!offer) return { success: false, error: 'Watcher offer not found' };

  // 2. Check not expired
  if (new Date() > offer.expiresAt) {
    return { success: false, error: 'This offer has expired' };
  }

  // 3. Verify buyer is watching this listing
  const [watchEntry] = await db
    .select({ id: watchlistItem.id })
    .from(watchlistItem)
    .where(and(eq(watchlistItem.userId, buyerId), eq(watchlistItem.listingId, offer.listingId)))
    .limit(1);

  if (!watchEntry) {
    return { success: false, error: 'You must be watching this listing to accept this offer' };
  }

  // 4. Verify listing is still active
  const [lst] = await db
    .select({ status: listing.status })
    .from(listing)
    .where(eq(listing.id, offer.listingId))
    .limit(1);

  if (!lst || lst.status !== 'ACTIVE') {
    return { success: false, error: 'Listing is no longer available' };
  }

  // 5. Create standard offer at discounted price (PENDING status)
  // Note: This creates an offer the seller can then accept via normal flow
  // The buyer will still need to provide payment when accepting
  const watcherOfferExpiryHours = await getPlatformSetting<number>('commerce.offer.watcherExpiryHours', 24);
  const expiresAt = new Date(Date.now() + watcherOfferExpiryHours * 60 * 60 * 1000);
  const [newOffer] = await db.insert(listingOffer).values({
    listingId: offer.listingId,
    buyerId,
    sellerId: offer.sellerId,
    offerCents: offer.discountedPriceCents,
    status: 'PENDING',
    type: 'WATCHER_OFFER',
    expiresAt,
    shippingAddressId,
    counterCount: 0,
  }).returning();

  if (!newOffer) {
    return { success: false, error: 'Failed to create offer' };
  }

  // Notify seller of the new offer (fire-and-forget)
  const [listingData] = await db
    .select({ title: listing.title, slug: listing.slug })
    .from(listing)
    .where(eq(listing.id, offer.listingId))
    .limit(1);

  notify(offer.sellerId, 'offer.received', {
    itemTitle: listingData?.title ?? 'Item',
    offerAmountFormatted: formatCents(offer.discountedPriceCents),
    offersUrl: `${BASE_URL}/my/selling/offers`,
    sellerName: 'Seller',
  }).catch((err) => logger.error('[watcher-offer] seller notification failed', { error: String(err) }));

  return {
    success: true,
    offerId: newOffer.id,
  };
}

interface CancelWatcherOfferResult {
  success: boolean;
  error?: string;
}

/**
 * Cancel a watcher offer — seller can cancel their active offer.
 * sellerId derived from session, NEVER from request body.
 */
export async function cancelWatcherOffer(input: unknown): Promise<CancelWatcherOfferResult> {
  const parsed = cancelWatcherOfferSchema.safeParse(
    typeof input === 'string' ? { watcherOfferId: input } : input
  );
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('delete', 'Promotion')) return { success: false, error: 'Not authorized' };
  const sellerId = session.userId;
  const { watcherOfferId } = parsed.data;
  // 1. Fetch watcher offer
  const [offer] = await db
    .select({
      id: watcherOffer.id,
      sellerId: watcherOffer.sellerId,
      expiresAt: watcherOffer.expiresAt,
    })
    .from(watcherOffer)
    .where(eq(watcherOffer.id, watcherOfferId))
    .limit(1);

  if (!offer) return { success: false, error: 'Watcher offer not found' };
  if (offer.sellerId !== sellerId) return { success: false, error: 'You do not own this offer' };

  // 2. Check if already expired (nothing to cancel)
  if (new Date() > offer.expiresAt) {
    return { success: false, error: 'This offer has already expired' };
  }

  // 3. Set expiresAt to now (effectively cancels it)
  await db
    .update(watcherOffer)
    .set({ expiresAt: new Date() })
    .where(eq(watcherOffer.id, watcherOfferId));

  return { success: true };
}

/**
 * Internal helper to get active watcher offer for a listing.
 */
async function getActiveWatcherOfferInternal(listingId: string) {
  const [offer] = await db
    .select()
    .from(watcherOffer)
    .where(and(eq(watcherOffer.listingId, listingId), gt(watcherOffer.expiresAt, new Date())))
    .limit(1);

  return offer ?? null;
}
