/**
 * C4 + C4.1 — Returns & Disputes: Query functions + auto-approve cron
 */

import { db } from '@twicely/db';
import { returnRequest, order } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';

/**
 * Check for returns that are past seller response deadline and auto-approve.
 * Called by scheduled job.
 */
export async function autoApproveOverdueReturns(): Promise<number> {
  const now = new Date();

  // Find pending returns past their response deadline
  const overdueReturns = await db
    .select({
      id: returnRequest.id,
      buyerId: returnRequest.buyerId,
      orderId: returnRequest.orderId,
      sellerResponseDueAt: returnRequest.sellerResponseDueAt,
    })
    .from(returnRequest)
    .where(eq(returnRequest.status, 'PENDING_SELLER'));

  // Filter to only overdue returns
  const toAutoApprove = overdueReturns.filter((ret) => {
    if (!ret.sellerResponseDueAt) return false;
    return ret.sellerResponseDueAt < now;
  });

  let count = 0;
  for (const ret of toAutoApprove) {
    await db
      .update(returnRequest)
      .set({
        status: 'APPROVED',
        sellerResponseNote: 'Auto-approved: Seller did not respond within 3 business days',
        updatedAt: now,
      })
      .where(
        and(
          eq(returnRequest.id, ret.id),
          eq(returnRequest.status, 'PENDING_SELLER')
        )
      );

    // Get order number for notification
    const [ord] = await db
      .select({ orderNumber: order.orderNumber })
      .from(order)
      .where(eq(order.id, ret.orderId))
      .limit(1);

    // Notify buyer that their return was auto-approved
    await notify(ret.buyerId, 'return.auto_approved', {
      orderNumber: ord?.orderNumber ?? '',
    });

    count++;
  }

  return count;
}

/**
 * Get return request by ID.
 */
export async function getReturnRequest(returnId: string) {
  const [req] = await db
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  return req ?? null;
}

/**
 * Get all returns for a buyer.
 */
export async function getBuyerReturns(buyerId: string) {
  return db
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.buyerId, buyerId))
    .orderBy(returnRequest.createdAt);
}

/**
 * Get all returns for a seller.
 */
export async function getSellerReturns(sellerId: string) {
  return db
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.sellerId, sellerId))
    .orderBy(returnRequest.createdAt);
}
