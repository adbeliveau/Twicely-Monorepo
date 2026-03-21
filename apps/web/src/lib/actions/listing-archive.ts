'use server';

import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';

/**
 * Archive a SOLD listing. It disappears from the default dashboard view
 * but remains in Sales History and tax exports.
 */
export async function archiveListing(
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

  if (lst.status !== 'SOLD') {
    return { success: false, error: 'Only sold listings can be archived' };
  }

  if (ability.cannot('update', sub('Listing', { ownerUserId: lst.ownerUserId }))) {
    return { success: false, error: 'Forbidden' };
  }

  await db
    .update(listing)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(listing.id, listingId));

  return { success: true };
}

/**
 * Unarchive a listing (restore to dashboard view).
 */
export async function unarchiveListing(
  listingId: string,
): Promise<{ success: boolean; error?: string }> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [lst] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!lst) {
    return { success: false, error: 'Not found' };
  }

  if (ability.cannot('update', sub('Listing', { ownerUserId: lst.ownerUserId }))) {
    return { success: false, error: 'Forbidden' };
  }

  await db
    .update(listing)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(listing.id, listingId));

  return { success: true };
}
