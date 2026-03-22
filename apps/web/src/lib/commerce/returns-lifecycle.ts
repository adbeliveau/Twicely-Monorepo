/**
 * C4 + C4.1 — Returns & Disputes: Lifecycle operations
 *
 * approveReturn, declineReturn, markReturnShipped, markReturnReceived, respondToReturn
 */

import { db } from '@twicely/db';
import { returnRequest, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { processReturnRefund } from '@twicely/stripe/refunds';
import type { ApproveReturnResult, RespondToReturnInput } from '@twicely/commerce/returns-types';

/**
 * Seller approves a return request.
 */
export async function approveReturn(
  sellerId: string,
  returnId: string
): Promise<ApproveReturnResult> {
  const [req] = await db
    .select({
      id: returnRequest.id,
      sellerId: returnRequest.sellerId,
      buyerId: returnRequest.buyerId,
      orderId: returnRequest.orderId,
      status: returnRequest.status,
      reason: returnRequest.reason,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  if (req.sellerId !== sellerId) {
    return { success: false, error: 'You do not own this return request' };
  }

  if (req.status !== 'PENDING_SELLER') {
    return { success: false, error: 'Return request is not pending approval' };
  }

  const now = new Date();

  await db
    .update(returnRequest)
    .set({
      status: 'APPROVED',
      sellerRespondedAt: now,
      updatedAt: now,
    })
    .where(eq(returnRequest.id, returnId));

  // Get order number for notification
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  // Notify buyer of approval
  await notify(req.buyerId, 'return.approved', {
    orderNumber: ord?.orderNumber ?? '',
  });

  return { success: true };
}

/**
 * Seller declines a return request.
 */
export async function declineReturn(
  sellerId: string,
  returnId: string,
  responseNote: string
): Promise<ApproveReturnResult> {
  const [req] = await db
    .select({
      id: returnRequest.id,
      sellerId: returnRequest.sellerId,
      buyerId: returnRequest.buyerId,
      orderId: returnRequest.orderId,
      status: returnRequest.status,
      reason: returnRequest.reason,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  if (req.sellerId !== sellerId) {
    return { success: false, error: 'You do not own this return request' };
  }

  if (req.status !== 'PENDING_SELLER') {
    return { success: false, error: 'Return request is not pending approval' };
  }

  // Seller cannot decline INR claims
  if (req.reason === 'INR') {
    return { success: false, error: 'Item Not Received claims cannot be declined' };
  }

  const now = new Date();

  await db
    .update(returnRequest)
    .set({
      status: 'DECLINED',
      sellerResponseNote: responseNote,
      sellerRespondedAt: now,
      updatedAt: now,
    })
    .where(eq(returnRequest.id, returnId));

  // Get order number for notification
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  // Notify buyer of decline
  await notify(req.buyerId, 'return.declined', {
    orderNumber: ord?.orderNumber ?? '',
    sellerNote: responseNote,
  });

  return { success: true };
}

/**
 * Buyer marks return as shipped with tracking.
 */
export async function markReturnShipped(
  buyerId: string,
  returnId: string,
  trackingNumber: string,
  carrier?: string
): Promise<ApproveReturnResult> {
  const [req] = await db
    .select({
      id: returnRequest.id,
      buyerId: returnRequest.buyerId,
      sellerId: returnRequest.sellerId,
      orderId: returnRequest.orderId,
      status: returnRequest.status,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  if (req.buyerId !== buyerId) {
    return { success: false, error: 'You do not own this return request' };
  }

  if (!['APPROVED', 'LABEL_GENERATED'].includes(req.status)) {
    return { success: false, error: 'Return must be approved before shipping' };
  }

  const now = new Date();

  await db
    .update(returnRequest)
    .set({
      status: 'SHIPPED',
      returnTrackingNumber: trackingNumber,
      returnCarrier: carrier,
      shippedAt: now,
      updatedAt: now,
    })
    .where(eq(returnRequest.id, returnId));

  // Get order number for notification
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  // Notify seller that return is on the way
  await notify(req.sellerId, 'return.shipped', {
    orderNumber: ord?.orderNumber ?? '',
    trackingNumber,
  });

  return { success: true };
}

/**
 * Seller marks return as received.
 */
export async function markReturnReceived(
  sellerId: string,
  returnId: string
): Promise<ApproveReturnResult> {
  const [req] = await db
    .select({
      id: returnRequest.id,
      sellerId: returnRequest.sellerId,
      buyerId: returnRequest.buyerId,
      orderId: returnRequest.orderId,
      status: returnRequest.status,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  if (req.sellerId !== sellerId) {
    return { success: false, error: 'You do not own this return request' };
  }

  if (req.status !== 'SHIPPED') {
    return { success: false, error: 'Return must be shipped before marking as received' };
  }

  const now = new Date();

  await db
    .update(returnRequest)
    .set({
      status: 'DELIVERED',
      deliveredAt: now,
      updatedAt: now,
    })
    .where(eq(returnRequest.id, returnId));

  // Get order number for notification
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  // Notify buyer that return has been received
  await notify(req.buyerId, 'return.received', {
    orderNumber: ord?.orderNumber ?? '',
  });

  // Process refund via Stripe (applies fees + issues refund)
  const refundResult = await processReturnRefund({ returnId });
  if (!refundResult.success) {
    // Refund failure is non-blocking; item was received. Manual review needed.
    // TODO: replace with structured logger (e.g. pino) when logging infra is in place
  }

  return { success: true };
}

/**
 * Seller responds to a return request (approve or decline).
 */
export async function respondToReturn(
  input: RespondToReturnInput
): Promise<ApproveReturnResult> {
  const { sellerId, returnId, approved, response = '' } = input;

  if (approved) {
    return approveReturn(sellerId, returnId);
  } else {
    return declineReturn(sellerId, returnId, response);
  }
}
