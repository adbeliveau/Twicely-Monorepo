/**
 * D2.4: Boost attribution — records boost fees when orders complete.
 *
 * Called fire-and-forget from order completion flow.
 * Checks if the sold listing had an active boost and the sale
 * fell within the attribution window; if so, records the fee
 * on orderPayment and logs a promotedListingEvent.
 */

import { db } from '@twicely/db';
import {
  orderItem,
  orderPayment,
  listing,
  promotedListing,
  promotedListingEvent,
} from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { isWithinAttributionWindow, calculateBoostFee } from './boosting';

export interface BoostAttributionResult {
  attributed: boolean;
  feeCents?: number;
}

/**
 * Check if a completed order qualifies for boost attribution
 * and, if so, record the fee on `orderPayment` and log an event.
 *
 * @param orderId - The order that was just completed
 * @param completedAt - Timestamp of order completion
 */
export async function recordBoostAttribution(
  orderId: string,
  completedAt: Date,
): Promise<BoostAttributionResult> {
  // 1. Get the listing(s) from the order
  const items = await db
    .select({
      listingId: orderItem.listingId,
      unitPriceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));

  if (items.length === 0) {
    return { attributed: false };
  }

  let totalBoostFeeCents = 0;
  let boostRateBps: number | undefined;

  for (const item of items) {
    // 2. Check if listing has an active boost
    const [listingData] = await db
      .select({
        boostPercent: listing.boostPercent,
        boostStartedAt: listing.boostStartedAt,
      })
      .from(listing)
      .where(eq(listing.id, item.listingId))
      .limit(1);

    if (!listingData?.boostPercent || !listingData.boostStartedAt) {
      continue;
    }

    // 3. Check attribution window
    const withinWindow = await isWithinAttributionWindow(
      listingData.boostStartedAt,
      completedAt,
    );

    if (!withinWindow) {
      continue;
    }

    // 4. Calculate fee on final sale price (unitPrice * quantity)
    const salePriceCents = item.unitPriceCents * item.quantity;
    const feeCents = calculateBoostFee(salePriceCents, listingData.boostPercent);

    if (feeCents <= 0) {
      continue;
    }

    totalBoostFeeCents += feeCents;
    boostRateBps = Math.round(listingData.boostPercent * 100);

    // 5. Find the promotedListing record and log a sale event
    const [promoted] = await db
      .select({ id: promotedListing.id })
      .from(promotedListing)
      .where(
        and(
          eq(promotedListing.listingId, item.listingId),
          eq(promotedListing.isActive, true),
        ),
      )
      .limit(1);

    if (promoted) {
      await db.insert(promotedListingEvent).values({
        promotedListingId: promoted.id,
        eventType: 'sale',
        orderId,
        feeCents,
      });

      // Atomic increment of cumulative counters
      await db.execute(
        sql`UPDATE promoted_listing
            SET sales = sales + 1,
                total_fee_cents = total_fee_cents + ${feeCents},
                updated_at = ${completedAt}
            WHERE id = ${promoted.id}`,
      );
    }
  }

  if (totalBoostFeeCents <= 0) {
    return { attributed: false };
  }

  // 6. Record boost fee on orderPayment
  await db
    .update(orderPayment)
    .set({
      boostFeeAmountCents: totalBoostFeeCents,
      boostRateBps: boostRateBps ?? null,
      updatedAt: completedAt,
    })
    .where(eq(orderPayment.orderId, orderId));

  logger.info('Boost attribution recorded', {
    orderId,
    feeCents: totalBoostFeeCents,
    rateBps: boostRateBps,
  });

  return { attributed: true, feeCents: totalBoostFeeCents };
}
