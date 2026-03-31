import { db } from '@twicely/db';
import { browsingHistory } from '@twicely/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

type EngagementAction = 'cart' | 'watchlist' | 'offer' | 'purchase' | 'price_alert';

/**
 * Update engagement flags for a browsing history entry.
 * Fire-and-forget — don't block the parent action if this fails.
 * Not a server action — internal helper only. Called by cart, watchlist, offer, and checkout actions.
 */
export async function updateEngagement(
  userId: string,
  listingId: string,
  action: EngagementAction
): Promise<void> {
  const columnMap: Record<EngagementAction, keyof typeof browsingHistory.$inferSelect> = {
    cart: 'didAddToCart',
    watchlist: 'didAddToWatchlist',
    offer: 'didMakeOffer',
    purchase: 'didPurchase',
    price_alert: 'didSetPriceAlert',
  };

  const column = columnMap[action];

  try {
    await db
      .update(browsingHistory)
      .set({ [column]: true })
      .where(
        and(eq(browsingHistory.userId, userId), eq(browsingHistory.listingId, listingId))
      );
  } catch {
    // Silent fail — engagement tracking is non-critical
    logger.error('[browsing-history] Failed to update engagement', { action });
  }
}
