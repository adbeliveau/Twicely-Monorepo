import { db } from '@twicely/db';
import { order, listingOffer } from '@twicely/db/schema';
import { eq, and, count } from 'drizzle-orm';

/**
 * Count orders that are in PAID status for the seller.
 * Shown as a warning before activating vacation mode.
 */
export async function getUnfulfilledOrderCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'PAID'),
      ),
    );
  return row?.total ?? 0;
}

/**
 * Count PENDING offers across all of the seller's listings.
 * Shown in UI as "X pending offers will be auto-declined."
 */
export async function getSellerPendingOffersCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(listingOffer)
    .where(
      and(
        eq(listingOffer.sellerId, userId),
        eq(listingOffer.status, 'PENDING'),
      ),
    );
  return row?.total ?? 0;
}
