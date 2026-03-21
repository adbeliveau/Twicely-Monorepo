'use server';

import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';

/**
 * Delete a listing. SOLD listings cannot be deleted — ever.
 * DRAFT, ENDED (unsold) → hard delete.
 * ACTIVE, PAUSED → should be delisted first (caller responsibility).
 */
export async function deleteListing(
  listingId: string,
): Promise<{ success: boolean; error?: string }> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [lst] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      status: listing.status,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!lst) {
    return { success: false, error: 'Not found' };
  }

  // SOLD listings cannot be deleted — ever
  if (lst.status === 'SOLD') {
    return {
      success: false,
      error: 'Sold listings are kept on record for your protection and cannot be deleted. You can hide this listing from your dashboard.',
    };
  }

  if (ability.cannot('delete', sub('Listing', { ownerUserId: lst.ownerUserId }))) {
    return { success: false, error: 'Forbidden' };
  }

  await db.delete(listing).where(eq(listing.id, listingId));

  return { success: true };
}
