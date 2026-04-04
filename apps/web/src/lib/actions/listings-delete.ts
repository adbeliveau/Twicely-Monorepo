'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { deleteListingDocument } from '@twicely/search/typesense-index';
import { z } from 'zod';

const deleteListingSchema = z.object({
  listingId: z.string().cuid2(),
}).strict();

interface ActionResult {
  success: boolean;
  listingId?: string;
  slug?: string;
  error?: string;
}

/**
 * Delete a listing (soft delete by ending, or hard delete for drafts).
 */
export async function deleteListing(listingId: string): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('delete', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = deleteListingSchema.safeParse({ listingId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    // Verify ownership
    const [existingListing] = await db
      .select({ id: listing.id, ownerUserId: listing.ownerUserId, status: listing.status })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existingListing) {
      return { success: false, error: 'Listing not found' };
    }

    if (existingListing.ownerUserId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Hard delete for drafts, soft delete (end) for others
    if (existingListing.status === 'DRAFT') {
      // Delete images first (cascade should handle this, but be explicit)
      await db.delete(listingImage).where(eq(listingImage.listingId, listingId));
      await db.delete(listing).where(eq(listing.id, listingId));
    } else {
      // Soft delete - set to ENDED
      await db
        .update(listing)
        .set({
          status: 'ENDED',
          endedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(listing.id, listingId));
    }

    // Remove from Typesense search index
    deleteListingDocument(listingId).catch((err) => {
      logger.error('[typesense] Failed to remove deleted listing from index', { listingId, error: String(err) });
    });

    revalidatePath('/my/selling');
    revalidatePath('/my/selling/listings');

    return { success: true, listingId };
  } catch (error) {
    logger.error('Delete listing error', { error });
    return { success: false, error: 'Failed to delete listing' };
  }
}
