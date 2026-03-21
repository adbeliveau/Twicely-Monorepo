'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { listing } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { getListingsByIdsForOwner, type ListingStatus } from '@/lib/queries/seller-listings';
import { logger } from '@twicely/logger';
import { z } from 'zod';

const bulkStatusSchema = z.object({
  listingIds: z.array(z.string().cuid2()).min(1).max(100),
  newStatus: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'SOLD']),
}).strict();

const bulkDeleteSchema = z.object({
  listingIds: z.array(z.string().cuid2()).min(1).max(100),
}).strict();

interface BulkActionResult {
  success: boolean;
  updatedCount?: number;
  skippedCount?: number;
  error?: string;
}

/**
 * Valid status transitions for bulk operations.
 * SOLD is system-only. DRAFT→ACTIVE is not allowed in bulk.
 */
const BULK_VALID_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['ENDED'],
  ACTIVE: ['PAUSED', 'ENDED'],
  PAUSED: ['ACTIVE', 'ENDED'],
  ENDED: [],
  SOLD: [],
};

function canBulkTransition(from: ListingStatus, to: ListingStatus): boolean {
  return BULK_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Bulk update listing status.
 * Only updates listings owned by the user with valid status transitions.
 * Invalid transitions are silently skipped (idempotent).
 */
export async function bulkUpdateListingStatus(
  listingIds: string[],
  newStatus: ListingStatus
): Promise<BulkActionResult> {
  const parsed = bulkStatusSchema.safeParse({ listingIds, newStatus });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  if (listingIds.length === 0) {
    return { success: true, updatedCount: 0, skippedCount: 0 };
  }

  // Validate newStatus is allowed for bulk operations
  if (newStatus === 'SOLD' || newStatus === 'DRAFT') {
    return { success: false, error: `Cannot bulk update to ${newStatus}` };
  }

  try {
    // Get owned listings with their current status
    const ownedListings = await getListingsByIdsForOwner(listingIds, userId);

    if (ownedListings.length === 0) {
      return { success: true, updatedCount: 0, skippedCount: listingIds.length };
    }

    // Filter to listings with valid transitions
    const validIds = ownedListings
      .filter((l) => canBulkTransition(l.status, newStatus))
      .map((l) => l.id);

    const skippedCount = ownedListings.length - validIds.length;

    if (validIds.length === 0) {
      return { success: true, updatedCount: 0, skippedCount };
    }

    // Build update data based on new status
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'ACTIVE') {
      updateData.activatedAt = new Date();
      updateData.pausedAt = null;
      updateData.endedAt = null;
    } else if (newStatus === 'PAUSED') {
      updateData.pausedAt = new Date();
    } else if (newStatus === 'ENDED') {
      updateData.endedAt = new Date();
    }

    // Perform bulk update
    await db
      .update(listing)
      .set(updateData)
      .where(
        and(
          eq(listing.ownerUserId, userId),
          inArray(listing.id, validIds)
        )
      );

    revalidatePath('/my/selling');
    revalidatePath('/my/selling/listings');

    return {
      success: true,
      updatedCount: validIds.length,
      skippedCount,
    };
  } catch (error) {
    logger.error('Bulk update listing status error', { error: String(error) });
    return { success: false, error: 'Failed to update listings' };
  }
}

/**
 * Bulk delete listings (soft-delete).
 * Only affects DRAFT or ENDED listings owned by the user.
 * DRAFT listings are soft-deleted by setting status to ENDED.
 * ENDED listings are already ended - counted but no DB change needed.
 * Active/Paused/Sold listings are skipped.
 */
export async function bulkDeleteListings(
  listingIds: string[]
): Promise<BulkActionResult> {
  const parsed = bulkDeleteSchema.safeParse({ listingIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('delete', sub('Listing', { ownerUserId: userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  if (listingIds.length === 0) {
    return { success: true, updatedCount: 0, skippedCount: 0 };
  }

  try {
    // Get owned listings with their current status
    const ownedListings = await getListingsByIdsForOwner(listingIds, userId);

    if (ownedListings.length === 0) {
      return { success: true, updatedCount: 0, skippedCount: listingIds.length };
    }

    // Filter to DRAFT or ENDED listings only
    const deletableListings = ownedListings.filter(
      (l) => l.status === 'DRAFT' || l.status === 'ENDED'
    );

    const skippedCount = ownedListings.length - deletableListings.length;

    if (deletableListings.length === 0) {
      return { success: true, updatedCount: 0, skippedCount };
    }

    // Separate DRAFT (soft-delete to ENDED) from ENDED (already ended, just count)
    const draftIds = deletableListings
      .filter((l) => l.status === 'DRAFT')
      .map((l) => l.id);

    // Soft-delete DRAFT listings by setting status to ENDED
    if (draftIds.length > 0) {
      await db
        .update(listing)
        .set({
          status: 'ENDED',
          endedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(listing.ownerUserId, userId),
            inArray(listing.id, draftIds)
          )
        );
    }

    // ENDED listings are already ended, no action needed

    revalidatePath('/my/selling');
    revalidatePath('/my/selling/listings');

    return {
      success: true,
      updatedCount: deletableListings.length,
      skippedCount,
    };
  } catch (error) {
    logger.error('Bulk delete listings error', { error: String(error) });
    return { success: false, error: 'Failed to delete listings' };
  }
}
