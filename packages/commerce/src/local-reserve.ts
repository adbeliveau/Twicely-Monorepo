/**
 * Listing Auto-Reserve Service (G2.14)
 *
 * Manages the listing status lifecycle for SafeTrade local transactions:
 *   - reserveListingForLocalTransaction: ACTIVE -> RESERVED when escrow created
 *   - unreserveListingForLocalTransaction: RESERVED/SOLD/PAUSED -> ACTIVE on cancel/no-show
 *   - markListingSoldForLocalTransaction: RESERVED/ACTIVE -> SOLD on completion
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A11
 */

import { db } from '@twicely/db';
import { orderItem, listing } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { declineAllPendingOffersForListing } from './offer-transitions';
import { logger } from '@twicely/logger';

// ─── Reserve ──────────────────────────────────────────────────────────────────

/**
 * Transition listing from ACTIVE to RESERVED when a local transaction is created.
 * Declines all pending offers per Feature Lock-in §1.
 * Returns error (not throw) if listing is not in ACTIVE status.
 */
export async function reserveListingForLocalTransaction(
  orderId: string,
): Promise<{ success: boolean; listingId?: string; error?: string }> {
  const now = new Date();

  // 1. Get listingId from orderItem
  const [item] = await db
    .select({ listingId: orderItem.listingId })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))
    .limit(1);

  if (!item) {
    logger.warn('[local-reserve] No orderItem found for orderId', { orderId });
    return { success: false, error: 'No orderItem found for orderId' };
  }

  const { listingId } = item;

  // 2. Get current listing status
  const [listingRow] = await db
    .select({ status: listing.status })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[local-reserve] Listing not found', { listingId, orderId });
    return { success: false, error: 'Listing not found' };
  }

  // 3. Only reserve if currently ACTIVE
  if (listingRow.status !== 'ACTIVE') {
    logger.warn('[local-reserve] Listing not in ACTIVE status — skipping reserve', {
      listingId,
      orderId,
      currentStatus: listingRow.status,
    });
    return { success: false, error: 'Listing not in ACTIVE status' };
  }

  // 4. Transition to RESERVED
  await db
    .update(listing)
    .set({ status: 'RESERVED', updatedAt: now })
    .where(eq(listing.id, listingId));

  // 5. Decline all pending offers — item is committed to this buyer
  await declineAllPendingOffersForListing(listingId);

  logger.info('[local-reserve] Listing reserved for local transaction', {
    listingId,
    orderId,
  });

  return { success: true, listingId };
}

// ─── Unreserve ────────────────────────────────────────────────────────────────

/**
 * Transition listing back to ACTIVE when a local transaction is canceled,
 * auto-canceled, or reaches NO_SHOW.
 *
 * Handles RESERVED, SOLD, and PAUSED -> ACTIVE.
 * Does NOT change DRAFT, ENDED, or REMOVED listings.
 * Gracefully no-ops if orderItem is missing.
 */
export async function unreserveListingForLocalTransaction(
  orderId: string,
): Promise<void> {
  const now = new Date();

  // 1. Get listingId from orderItem
  const [item] = await db
    .select({ listingId: orderItem.listingId })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))
    .limit(1);

  if (!item) {
    logger.warn('[local-reserve] No orderItem found for unreserve — skipping', { orderId });
    return;
  }

  const { listingId } = item;

  // 2. Get current listing status
  const [listingRow] = await db
    .select({ status: listing.status })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[local-reserve] Listing not found for unreserve', { listingId, orderId });
    return;
  }

  const { status } = listingRow;

  // 3. Restore to ACTIVE for RESERVED, SOLD, or PAUSED
  if (status === 'RESERVED' || status === 'SOLD' || status === 'PAUSED') {
    await db
      .update(listing)
      .set({ status: 'ACTIVE', updatedAt: now })
      .where(eq(listing.id, listingId));

    logger.info('[local-reserve] Listing unreserved — restored to ACTIVE', {
      listingId,
      orderId,
      previousStatus: status,
    });
    return;
  }

  // 4. Do not change DRAFT, ENDED, REMOVED, or already ACTIVE
  logger.info('[local-reserve] Listing not eligible for unreserve — no change', {
    listingId,
    orderId,
    currentStatus: status,
  });
}

// ─── Mark Sold ────────────────────────────────────────────────────────────────

/**
 * Transition listing from RESERVED (or ACTIVE) to SOLD when local transaction completes.
 * Sets soldAt timestamp.
 * Gracefully no-ops if orderItem is missing or listing already SOLD.
 */
export async function markListingSoldForLocalTransaction(
  orderId: string,
): Promise<void> {
  const now = new Date();

  // 1. Get listingId from orderItem
  const [item] = await db
    .select({ listingId: orderItem.listingId })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))
    .limit(1);

  if (!item) {
    logger.warn('[local-reserve] No orderItem found for markSold — skipping', { orderId });
    return;
  }

  const { listingId } = item;

  // 2. Get current listing status
  const [listingRow] = await db
    .select({ status: listing.status })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    logger.warn('[local-reserve] Listing not found for markSold', { listingId, orderId });
    return;
  }

  // 3. Transition RESERVED or ACTIVE to SOLD
  if (listingRow.status === 'RESERVED' || listingRow.status === 'ACTIVE') {
    await db
      .update(listing)
      .set({ status: 'SOLD', soldAt: now, updatedAt: now })
      .where(eq(listing.id, listingId));

    logger.info('[local-reserve] Listing marked SOLD for completed local transaction', {
      listingId,
      orderId,
      previousStatus: listingRow.status,
    });
  }
}
