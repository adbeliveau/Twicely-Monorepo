import { db } from '@twicely/db';
import { listing, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

type UnavailableReason =
  | 'NOT_FOUND'
  | 'SOLD'
  | 'RESERVED'
  | 'PAUSED'
  | 'ENDED'
  | 'REMOVED'
  | 'INSUFFICIENT_QUANTITY'
  | 'SELLER_ON_VACATION'
  | 'SELLER_ON_VACATION_ALLOW_SALES';

interface AvailabilityResult {
  available: boolean;
  reason?: UnavailableReason;
  availableQuantity?: number;
}

/**
 * Check if a listing is available for purchase.
 * NOT a server action - just an async utility function.
 */
export async function checkListingAvailability(
  listingId: string,
  requestedQuantity: number
): Promise<AvailabilityResult> {
  // Fetch listing with status and quantity
  const [listingRow] = await db
    .select({
      id: listing.id,
      status: listing.status,
      availableQuantity: listing.availableQuantity,
      ownerUserId: listing.ownerUserId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    return { available: false, reason: 'NOT_FOUND' };
  }

  // Check listing status
  if (listingRow.status === 'SOLD') {
    return { available: false, reason: 'SOLD', availableQuantity: 0 };
  }

  if (listingRow.status === 'RESERVED') {
    return { available: false, reason: 'RESERVED', availableQuantity: 0 };
  }

  if (listingRow.status === 'PAUSED') {
    return { available: false, reason: 'PAUSED', availableQuantity: listingRow.availableQuantity ?? 0 };
  }

  if (listingRow.status === 'ENDED') {
    return { available: false, reason: 'ENDED', availableQuantity: 0 };
  }

  if (listingRow.status === 'REMOVED') {
    return { available: false, reason: 'REMOVED', availableQuantity: 0 };
  }

  if (listingRow.status !== 'ACTIVE') {
    return { available: false, reason: 'NOT_FOUND', availableQuantity: 0 };
  }

  // Check quantity
  const available = listingRow.availableQuantity ?? 0;
  if (available < requestedQuantity) {
    return { available: false, reason: 'INSUFFICIENT_QUANTITY', availableQuantity: available };
  }

  // Check seller vacation mode
  const [seller] = await db
    .select({
      vacationMode: sellerProfile.vacationMode,
      vacationModeType: sellerProfile.vacationModeType,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, listingRow.ownerUserId))
    .limit(1);

  if (seller?.vacationMode) {
    if (seller.vacationModeType === 'ALLOW_SALES') {
      return { available: true, reason: 'SELLER_ON_VACATION_ALLOW_SALES', availableQuantity: available };
    }
    // PAUSE_SALES, CUSTOM, or null modeType — block purchase
    return { available: false, reason: 'SELLER_ON_VACATION', availableQuantity: available };
  }

  return { available: true, availableQuantity: available };
}
