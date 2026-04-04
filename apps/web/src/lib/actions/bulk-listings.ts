'use server';

/**
 * B5.2 — Bulk Listing Management
 *
 * Server actions for bulk listing operations:
 * - ACTIVATE: Publish multiple drafts
 * - DEACTIVATE: Pause multiple active listings
 * - DELETE: End multiple listings
 * - PRICE_ADJUST: Adjust prices by percentage or fixed amount
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { recordPriceChange } from '@/lib/services/price-history-service';
import { eq, and, inArray } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';

const bulkActionSchema = z.object({
  listingIds: z.array(z.string().cuid2()).min(1).max(100),
  action: z.enum(['ACTIVATE', 'DEACTIVATE', 'DELETE', 'PRICE_ADJUST']),
  priceAdjustment: z.object({
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number(),
    direction: z.enum(['INCREASE', 'DECREASE']),
  }).strict().optional(),
}).strict();

type BulkAction = 'ACTIVATE' | 'DEACTIVATE' | 'DELETE' | 'PRICE_ADJUST';

interface BulkActionResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ listingId: string; error: string }>;
}

interface PriceAdjustment {
  type: 'PERCENTAGE' | 'FIXED';
  value: number;  // Percentage (-50 to +100) or cents
  direction: 'INCREASE' | 'DECREASE';
}

/**
 * Bulk update listings with a specific action.
 */
export async function bulkUpdateListingsAction(
  listingIds: string[],
  action: BulkAction,
  priceAdjustment?: PriceAdjustment
): Promise<BulkActionResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, processed: 0, failed: listingIds.length, errors: [{ listingId: '', error: 'Unauthorized' }] };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, processed: 0, failed: listingIds.length, errors: [{ listingId: '', error: 'Forbidden' }] };
  }

  const parsed = bulkActionSchema.safeParse({ listingIds, action, priceAdjustment });
  if (!parsed.success) {
    return { success: false, processed: 0, failed: listingIds.length, errors: [{ listingId: '', error: parsed.error.issues[0]?.message ?? 'Invalid input' }] };
  }

  if (listingIds.length === 0) {
    return { success: true, processed: 0, failed: 0, errors: [] };
  }

  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  };

  // Fetch all listings and verify ownership
  const listings = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      status: listing.status,
      priceCents: listing.priceCents,
    })
    .from(listing)
    .where(inArray(listing.id, listingIds));

  const ownedListings = listings.filter((l) => l.ownerUserId === userId);
  const notOwnedIds = listingIds.filter((id) => !ownedListings.some((l) => l.id === id));

  // Add errors for listings not owned
  for (const id of notOwnedIds) {
    result.errors.push({ listingId: id, error: 'Not found or not owned' });
    result.failed++;
  }

  if (ownedListings.length === 0) {
    result.success = false;
    return result;
  }

  const now = new Date();

  switch (action) {
    case 'ACTIVATE': {
      // Can only activate DRAFT or PAUSED listings
      const validListings = ownedListings.filter(
        (l) => l.status === 'DRAFT' || l.status === 'PAUSED'
      );

      for (const l of ownedListings) {
        if (l.status !== 'DRAFT' && l.status !== 'PAUSED') {
          result.errors.push({ listingId: l.id, error: `Cannot activate from ${l.status} status` });
          result.failed++;
        }
      }

      if (validListings.length > 0) {
        await db
          .update(listing)
          .set({
            status: 'ACTIVE',
            activatedAt: now,
            pausedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              inArray(listing.id, validListings.map((l) => l.id)),
              eq(listing.ownerUserId, userId)
            )
          );

        result.processed = validListings.length;
      }
      break;
    }

    case 'DEACTIVATE': {
      // Can only deactivate ACTIVE listings
      const validListings = ownedListings.filter((l) => l.status === 'ACTIVE');

      for (const l of ownedListings) {
        if (l.status !== 'ACTIVE') {
          result.errors.push({ listingId: l.id, error: `Cannot deactivate from ${l.status} status` });
          result.failed++;
        }
      }

      if (validListings.length > 0) {
        await db
          .update(listing)
          .set({
            status: 'PAUSED',
            pausedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              inArray(listing.id, validListings.map((l) => l.id)),
              eq(listing.ownerUserId, userId)
            )
          );

        result.processed = validListings.length;
      }
      break;
    }

    case 'DELETE': {
      // Can end any listing except SOLD
      const validListings = ownedListings.filter((l) => l.status !== 'SOLD');

      for (const l of ownedListings) {
        if (l.status === 'SOLD') {
          result.errors.push({ listingId: l.id, error: 'Cannot delete sold listing' });
          result.failed++;
        }
      }

      if (validListings.length > 0) {
        await db
          .update(listing)
          .set({
            status: 'ENDED',
            endedAt: now,
            updatedAt: now,
          })
          .where(
            and(
              inArray(listing.id, validListings.map((l) => l.id)),
              eq(listing.ownerUserId, userId)
            )
          );

        result.processed = validListings.length;
      }
      break;
    }

    case 'PRICE_ADJUST': {
      if (!priceAdjustment) {
        result.success = false;
        result.errors.push({ listingId: '', error: 'Price adjustment parameters required' });
        return result;
      }

      // Can only adjust ACTIVE or PAUSED listings
      const validListings = ownedListings.filter(
        (l) => (l.status === 'ACTIVE' || l.status === 'PAUSED') && l.priceCents
      );

      for (const l of ownedListings) {
        if (l.status !== 'ACTIVE' && l.status !== 'PAUSED') {
          result.errors.push({ listingId: l.id, error: `Cannot adjust price for ${l.status} listing` });
          result.failed++;
        }
      }

      // Process each listing individually for price history
      for (const l of validListings) {
        const oldPrice = l.priceCents!;
        let newPrice: number;

        if (priceAdjustment.type === 'PERCENTAGE') {
          const multiplier = priceAdjustment.direction === 'INCREASE'
            ? 1 + priceAdjustment.value / 100
            : 1 - priceAdjustment.value / 100;
          newPrice = Math.round(oldPrice * multiplier);
        } else {
          newPrice = priceAdjustment.direction === 'INCREASE'
            ? oldPrice + priceAdjustment.value
            : oldPrice - priceAdjustment.value;
        }

        // Ensure price is at least 1 cent
        newPrice = Math.max(1, newPrice);

        if (newPrice === oldPrice) {
          continue;
        }

        // Update price
        await db
          .update(listing)
          .set({
            priceCents: newPrice,
            updatedAt: now,
          })
          .where(eq(listing.id, l.id));

        // Record price history
        await recordPriceChange({
          listingId: l.id,
          newPriceCents: newPrice,
          previousCents: oldPrice,
          changeReason: 'MANUAL',
          changedByUserId: userId,
        });

        result.processed++;
      }
      break;
    }
  }

  result.success = result.failed === 0;

  revalidatePath('/my/selling');
  revalidatePath('/my/selling/listings');

  return result;
}

