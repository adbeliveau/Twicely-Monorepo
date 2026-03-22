/**
 * Notify followers when a seller publishes a new ACTIVE listing.
 * Per Feature Lock-in §12: "Following creates a feed of new listings from followed sellers."
 * Fire-and-forget — errors logged, never thrown.
 */

import { db } from '@twicely/db';
import { listing, follow, user, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { formatPrice } from '@twicely/utils/format';
import { logger } from '@twicely/logger';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

export async function notifyFollowedSellerNewListing(listingId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        title: listing.title,
        slug: listing.slug,
        priceCents: listing.priceCents,
        ownerUserId: listing.ownerUserId,
      })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!row) return;

    const [seller] = await db
      .select({
        displayName: user.displayName,
        storeName: sellerProfile.storeName,
      })
      .from(user)
      .leftJoin(sellerProfile, eq(sellerProfile.userId, user.id))
      .where(eq(user.id, row.ownerUserId))
      .limit(1);

    const sellerName = seller?.storeName ?? seller?.displayName ?? 'A seller';

    const followers = await db
      .select({ followerId: follow.followerId })
      .from(follow)
      .where(eq(follow.followedId, row.ownerUserId));

    if (followers.length === 0) return;

    const data = {
      sellerName,
      listingTitle: row.title ?? 'New item',
      priceFormatted: formatPrice(row.priceCents ?? 0),
      listingUrl: `${BASE_URL}/i/${row.slug}`,
    };

    for (const { followerId } of followers) {
      notify(followerId, 'social.followed_seller_new_listing', data).catch(() => {});
    }
  } catch (err) {
    logger.error('[followed-seller-notifier] Error', { error: String(err) });
  }
}
