/**
 * Pre-shipment order cancellation with Stripe refund + ledger entry.
 * Extracted from shipping.ts for file size compliance.
 */

import { db } from '@twicely/db';
import { order, ledgerEntry } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { stripe } from '@twicely/stripe/server';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

interface CancelOrderResult { success: boolean; error?: string }

/**
 * Cancel an order (business logic - NOT a server action).
 * Only works if order is in PAID status (not yet shipped).
 * Issues a full refund via Stripe with reverse_transfer + refund_application_fee.
 * Creates a REFUND_FULL ledger entry for reconciliation.
 */
export async function cancelOrder(
  orderId: string,
  userId: string,
  reason: string
): Promise<CancelOrderResult> {
  const [orderData] = await db
    .select({
      id: order.id,
      status: order.status,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      orderNumber: order.orderNumber,
      paymentIntentId: order.paymentIntentId,
      totalCents: order.totalCents,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!orderData) {
    return { success: false, error: 'Order not found' };
  }

  const isBuyer = orderData.buyerId === userId;
  const isSeller = orderData.sellerId === userId;

  if (!isBuyer && !isSeller) {
    return { success: false, error: 'Unauthorized' };
  }

  if (orderData.status !== 'PAID') {
    return { success: false, error: 'Order can only be canceled if it is in PAID status' };
  }

  if (!orderData.paymentIntentId) {
    return { success: false, error: 'Order has no payment to refund' };
  }

  const cancelInitiator = isBuyer ? 'BUYER' : 'SELLER';

  // Buyer-only: enforce cancellation time window
  if (isBuyer) {
    const cancelWindowHours = await getPlatformSetting<number>('commerce.cancel.buyerWindowHours', 1);
    const hoursSincePaid = (Date.now() - new Date(orderData.paidAt ?? orderData.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSincePaid > cancelWindowHours) {
      return { success: false, error: 'Cancellation window has expired' };
    }
  }

  try {
    // Issue full refund via Stripe FIRST (before any DB changes)
    const refund = await stripe.refunds.create({
      payment_intent: orderData.paymentIntentId,
      amount: orderData.totalCents,
      reason: 'requested_by_customer',
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: { orderId, cancelInitiator, source: 'order_cancel' },
    });

    const now = new Date();

    // Update order status
    await db
      .update(order)
      .set({
        status: 'CANCELED',
        canceledAt: now,
        canceledByUserId: userId,
        cancelInitiator,
        cancelReason: reason,
        updatedAt: now,
      })
      .where(eq(order.id, orderId));

    // Create REFUND_FULL ledger entry for reconciliation
    await db.insert(ledgerEntry).values({
      type: 'REFUND_FULL',
      status: 'POSTED',
      amountCents: -orderData.totalCents,
      userId: orderData.sellerId,
      orderId,
      stripeRefundId: refund.id,
      postedAt: now,
      reasonCode: `order_cancel:${cancelInitiator.toLowerCase()}`,
      memo: `Pre-shipment cancellation by ${cancelInitiator.toLowerCase()}`,
    });

    // Notify both parties of cancellation
    const otherPartyId = isBuyer ? orderData.sellerId : orderData.buyerId;
    await notify(otherPartyId, 'order.canceled', {
      orderNumber: orderData.orderNumber,
      cancelReason: reason,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to cancel order', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order',
    };
  }
}
