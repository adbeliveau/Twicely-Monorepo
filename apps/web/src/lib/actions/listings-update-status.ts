'use server';

/**
 * Listing Status & Read Actions
 * Split from listings-update.ts for file-size compliance.
 * updateListingStatus, getListingForEdit.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing, listingImage } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';
import { logger } from '@twicely/logger';
import { processBackInStockAlerts } from '@/lib/services/price-alert-processor';
import { enqueueSearchIndexUpsert, enqueueSearchIndexDelete } from '@twicely/jobs/search-index-sync';

const updateListingStatusSchema = z.object({
  listingId: z.string().cuid2(),
  newStatus: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED']),
}).strict();

/** User-settable statuses (SOLD excluded — only set by checkout system) */
type UserListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
/** All possible statuses including system-only */
type ListingStatus = UserListingStatus | 'SOLD';

interface ActionResult {
  success: boolean;
  listingId?: string;
  slug?: string;
  error?: string;
}

/**
 * Valid status transitions for listings.
 */
const VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['ACTIVE', 'ENDED'],
  ACTIVE: ['PAUSED', 'ENDED', 'SOLD'],
  PAUSED: ['ACTIVE', 'ENDED'],
  ENDED: ['ACTIVE'], // Relist
  SOLD: [], // Terminal state
};

function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Update listing status only (pause, unpause, end).
 */
export async function updateListingStatus(
  listingId: string,
  newStatus: string
): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateListingStatusSchema.safeParse({ listingId, newStatus });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    // Verify ownership and get current status
    const [existingListing] = await db
      .select({ id: listing.id, ownerUserId: listing.ownerUserId, status: listing.status, title: listing.title })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!existingListing) {
      return { success: false, error: 'Listing not found' };
    }

    if (existingListing.ownerUserId !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const currentStatus = existingListing.status as ListingStatus;
    if (!canTransition(currentStatus, newStatus as ListingStatus)) {
      return { success: false, error: `Cannot change status from ${currentStatus} to ${newStatus}` };
    }

    // Build update object based on new status
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    const wasUnavailable = currentStatus === 'SOLD' || currentStatus === 'ENDED';

    if (newStatus === 'ACTIVE' && currentStatus !== 'ACTIVE') {
      updateData.activatedAt = new Date();
      updateData.pausedAt = null;
      updateData.endedAt = null;

      // Fire-and-forget: notify BACK_IN_STOCK alerts if listing was sold/ended
      if (wasUnavailable) {
        processBackInStockAlerts(listingId).catch((err) => {
          logger.error('[back-in-stock-alerts] Failed for listing', { listingId, error: String(err) });
        });
      }
    } else if (newStatus === 'PAUSED') {
      updateData.pausedAt = new Date();
    } else if (newStatus === 'ENDED') {
      updateData.endedAt = new Date();
    } else if (newStatus === 'SOLD') {
      updateData.soldAt = new Date();
    }

    await db.update(listing).set(updateData).where(eq(listing.id, listingId));

    // Fire-and-forget: sync search index via BullMQ — remove non-ACTIVE listings
    if (newStatus === 'ACTIVE') {
      enqueueSearchIndexUpsert({
        id: listingId,
        title: existingListing.title ?? '',
        ownerUserId: userId,
        priceCents: 0,
        freeShipping: false,
        sellerScore: 0,
        sellerTotalReviews: 0,
        activatedAt: Math.floor(Date.now() / 1000),
        createdAt: Math.floor(Date.now() / 1000),
      }).catch((err) => {
        logger.error('[search-index] Failed to enqueue reactivated listing', { listingId, error: String(err) });
      });
    } else {
      enqueueSearchIndexDelete(listingId).catch((err) => {
        logger.error('[search-index] Failed to enqueue listing removal', { listingId, error: String(err) });
      });
    }

    revalidatePath('/my/selling');
    revalidatePath('/my/selling/listings');

    return { success: true, listingId };
  } catch (error) {
    logger.error('Update listing status error', { error: String(error) });
    return { success: false, error: 'Failed to update status' };
  }
}

/**
 * Get a listing by ID for editing (with ownership check).
 */
export async function getListingForEdit(listingId: string) {
  const { ability, session } = await authorize();
  if (!session) return null;
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Listing', { ownerUserId: userId }))) return null;

  const [result] = await db
    .select()
    .from(listing)
    .where(and(eq(listing.id, listingId), eq(listing.ownerUserId, userId)))
    .limit(1);

  if (!result) {
    return null;
  }

  // Get images
  const images = await db
    .select()
    .from(listingImage)
    .where(eq(listingImage.listingId, listingId))
    .orderBy(listingImage.position);

  return { listing: result, images };
}

