/**
 * Local Fraud Signal 3 — No-Show Relist Check (G2.15)
 *
 * INVESTIGATION signal: seller relists an item within 24 hours after a
 * no-show. Detected by the local-fraud-noshow-relist BullMQ worker at 24hr
 * delay from the no-show timestamp.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

import { db } from '@twicely/db';
import {
  localTransaction,
  localFraudFlag,
  orderItem,
  listing,
  auditEvent,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

// ─── Signal 3 ─────────────────────────────────────────────────────────────────

/**
 * Check if the seller relisted the item within 24 hours after a no-show.
 * Called by local-fraud-noshow-relist.ts BullMQ worker at 24hr delay.
 */
export async function checkNoshowRelist(
  localTransactionId: string,
  sellerId: string,
  orderId: string,
): Promise<void> {
  const now = new Date();

  // Load the local transaction — confirm still in NO_SHOW
  const [tx] = await db
    .select({ status: localTransaction.status, updatedAt: localTransaction.updatedAt })
    .from(localTransaction)
    .where(eq(localTransaction.id, localTransactionId))
    .limit(1);

  if (!tx || tx.status !== 'NO_SHOW') {
    return;
  }

  const noShowTimestamp = tx.updatedAt;

  // Get listingId from orderItem
  const [item] = await db
    .select({ listingId: orderItem.listingId })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))
    .limit(1);

  if (!item) {
    return;
  }

  const { listingId } = item;

  // Check if listing is ACTIVE and updatedAt > noShowTimestamp (seller re-activated it)
  const [listingRow] = await db
    .select({ status: listing.status, updatedAt: listing.updatedAt })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow || listingRow.status !== 'ACTIVE') {
    return;
  }

  if (listingRow.updatedAt <= noShowTimestamp) {
    return;
  }

  // Signal 3: create STRONG_SIGNAL fraud flag
  await db.insert(localFraudFlag).values({
    sellerId,
    localTransactionId,
    listingId,
    trigger: 'NOSHOW_RELIST',
    severity: 'STRONG_SIGNAL',
    status: 'OPEN',
    detailsJson: {
      noShowTimestamp: noShowTimestamp.toISOString(),
      relistDetectedAt: now.toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  });

  // Flag the listing for review
  await db
    .update(listing)
    .set({ enforcementState: 'FLAGGED', updatedAt: now })
    .where(eq(listing.id, listingId));

  // Audit event
  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId: 'fraud-detection',
    action: 'FRAUD_SIGNAL_3_NOSHOW_RELIST',
    subject: 'LocalTransaction',
    subjectId: localTransactionId,
    severity: 'HIGH',
    detailsJson: { sellerId, listingId },
  });

  // Notify seller
  void notify(sellerId, 'local.fraud.seller_flagged', {
    listingId,
    transactionId: localTransactionId,
  }).catch(() => {});

  logger.info('[local-fraud] Signal 3 (no-show relist) detected', {
    localTransactionId,
    sellerId,
    listingId,
  });
}
