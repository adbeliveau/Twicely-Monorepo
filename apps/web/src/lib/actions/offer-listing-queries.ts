'use server';

import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { authorize, sub } from '@twicely/casl';
import { getActiveOffersForListing } from '@twicely/commerce/offer-queries';
import type { OfferWithDetails } from '@twicely/commerce/offer-queries';

const getOffersForListingSchema = z.object({
  listingId: zodId,
}).strict();

interface GetOffersResult {
  success: boolean;
  offers?: OfferWithDetails[];
  error?: string;
}

/**
 * Get active (PENDING) offers for a specific listing.
 * Used by the seller listing detail "Offers" tab.
 * Only the listing owner can view offers.
 */
export async function getActiveOffersForListingAction(
  listingId: string
): Promise<GetOffersResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!ability.can('read', sub('Offer', { sellerId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = getOffersForListingSchema.safeParse({ listingId });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const offers = await getActiveOffersForListing(parsed.data.listingId);

  // Ensure caller owns the listing (all offers for a listing share the same sellerId)
  if (offers.length > 0 && offers[0]!.sellerId !== session.userId) {
    return { success: false, error: 'Not found' };
  }

  return { success: true, offers };
}
