/**
 * Order completion logic — extracted from shipping.ts
 *
 * Handles marking orders as completed and auto-completing
 * delivered orders after the configurable escrow hold period.
 */

import { db } from '@twicely/db';
import { order, orderItem, listing } from '@twicely/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { recordPurchaseSignal } from './personalization-signals';
import { detectSameListingSold } from '@twicely/commerce/local-fraud-detection';
import { updateThresholdFlag } from './tax-threshold-tracker';

interface MarkOrderCompletedResult {
  success: boolean;
  error?: string;
}

/**
 * Mark an order as completed (business logic - NOT a server action).
 * Called after buyer has had time to inspect item (3 days after delivery).
 */
export async function markOrderCompleted(
  orderId: string
): Promise<MarkOrderCompletedResult> {
  const [orderData] = await db
    .select({
      id: order.id,
      status: order.status,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      orderNumber: order.orderNumber,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!orderData) {
    return { success: false, error: 'Order not found' };
  }

  if (orderData.status !== 'DELIVERED') {
    return { success: false, error: 'Order must be in DELIVERED status to complete' };
  }

  // G2.15: Check for Signal 1 fraud before completing the order.
  // The shipped order still completes — fraud consequences are applied internally.
  try {
    const [item] = await db
      .select({ listingId: orderItem.listingId })
      .from(orderItem)
      .where(eq(orderItem.orderId, orderId))
      .limit(1);

    if (item?.listingId) {
      await detectSameListingSold(orderId, item.listingId, orderData.sellerId);
    }
  } catch {
    // Do not block order completion for fraud detection failures
    logger.error('Fraud detection failed for order', { orderId });
  }

  const now = new Date();

  try {
    await db
      .update(order)
      .set({
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(order.id, orderId));

    // Fire-and-forget: record purchase signals for personalization
    try {
      const items = await db
        .select({
          buyerId: order.buyerId,
          categoryId: listing.categoryId,
        })
        .from(orderItem)
        .innerJoin(order, eq(orderItem.orderId, order.id))
        .innerJoin(listing, eq(orderItem.listingId, listing.id))
        .where(eq(orderItem.orderId, orderId));

      for (const item of items) {
        if (item.categoryId) {
          recordPurchaseSignal(item.buyerId, item.categoryId).catch(() => {});
        }
      }
    } catch {
      // Do not block order completion for personalization failures
    }

    // Fire-and-forget: update 1099-K threshold flag for seller (G5.3)
    updateThresholdFlag(orderData.sellerId).catch(() => {});

    return { success: true };
  } catch (error) {
    logger.error('Failed to mark order as completed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark order as completed',
    };
  }
}

/**
 * Auto-complete orders that have been DELIVERED past the escrow hold period.
 * Called by cron job to finalize transactions.
 */
export async function autoCompleteDeliveredOrders(): Promise<number> {
  const holdHours = await getPlatformSetting<number>('commerce.escrow.holdHours', 72);
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - holdHours);

  const eligibleOrders = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.status, 'DELIVERED'),
        lt(order.deliveredAt, cutoff)
      )
    );

  let completedCount = 0;
  for (const ord of eligibleOrders) {
    const result = await markOrderCompleted(ord.id);
    if (result.success) {
      completedCount++;
    }
  }

  return completedCount;
}
