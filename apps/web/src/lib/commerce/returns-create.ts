/**
 * C4 + C4.1 — Returns & Disputes: Create return request
 */

import { db } from '@twicely/db';
import { returnRequest, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import {
  getReturnWindowDays,
  getCounterfeitWindowDays,
  REASON_FAULT_MAP,
  REASON_BUCKET_MAP,
  RETURN_SHIPPING_PAYER,
} from '@twicely/commerce/returns-types';
import type {
  ReturnReason,
  CreateReturnRequestInput,
  CreateReturnRequestResult,
} from '@twicely/commerce/returns-types';
import { isWithinReturnWindow, isValidINRClaim, calculateSellerResponseDue } from '@twicely/commerce/returns-validation';

/**
 * Create a return request.
 */
export async function createReturnRequest(
  input: CreateReturnRequestInput
): Promise<CreateReturnRequestResult> {
  const { buyerId, orderId, reason, description, evidencePhotos = [] } = input;

  // Get order
  const [ord] = await db
    .select({
      id: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveredAt: order.deliveredAt,
      expectedDeliveryAt: order.expectedDeliveryAt,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return { success: false, error: 'Order not found' };
  }

  // Verify buyer owns the order
  if (ord.buyerId !== buyerId) {
    return { success: false, error: 'You do not own this order' };
  }

  // Check order status allows returns
  const returnableStatuses = ['DELIVERED', 'COMPLETED'];
  if (reason === 'INR') {
    // INR can be filed on shipped orders that haven't been delivered
    if (!['SHIPPED', 'IN_TRANSIT'].includes(ord.status)) {
      return { success: false, error: 'Order must be shipped to file Item Not Received claim' };
    }
  } else {
    if (!returnableStatuses.includes(ord.status)) {
      return { success: false, error: 'Order must be delivered to request a return' };
    }
  }

  // Check return window
  if (reason === 'INR') {
    if (!isValidINRClaim(ord.deliveredAt, ord.expectedDeliveryAt)) {
      return { success: false, error: 'Cannot file Item Not Received claim for a delivered order' };
    }
  } else {
    if (!await isWithinReturnWindow(ord.deliveredAt, reason)) {
      const windowDays = reason === 'COUNTERFEIT'
        ? await getCounterfeitWindowDays()
        : await getReturnWindowDays();
      return { success: false, error: `Return window (${windowDays} days) has expired` };
    }
  }

  // Check if return already exists
  const [existingReturn] = await db
    .select({ id: returnRequest.id })
    .from(returnRequest)
    .where(eq(returnRequest.orderId, orderId))
    .limit(1);

  if (existingReturn) {
    return { success: false, error: 'A return request already exists for this order' };
  }

  // Require evidence photos for INAD, DAMAGED, COUNTERFEIT
  const photosRequired: ReturnReason[] = ['INAD', 'DAMAGED', 'COUNTERFEIT'];
  if (photosRequired.includes(reason) && evidencePhotos.length === 0) {
    return { success: false, error: 'Photo evidence is required for this return reason' };
  }

  const fault = REASON_FAULT_MAP[reason];
  const bucket = REASON_BUCKET_MAP[reason];
  const returnShippingPaidBy = RETURN_SHIPPING_PAYER[reason];
  const sellerResponseDueAt = await calculateSellerResponseDue();

  // Create return request
  const [created] = await db
    .insert(returnRequest)
    .values({
      orderId,
      buyerId,
      sellerId: ord.sellerId,
      reason,
      fault,
      bucket,
      description,
      evidencePhotos,
      returnShippingPaidBy: returnShippingPaidBy === 'N/A' ? null : returnShippingPaidBy,
      sellerResponseDueAt: reason === 'INR' ? null : sellerResponseDueAt, // INR doesn't need seller response
      status: reason === 'INR' ? 'APPROVED' : 'PENDING_SELLER', // INR auto-approves
    })
    .returning({ id: returnRequest.id });

  // Notify seller of return request
  await notify(ord.sellerId, 'return.requested', {
    orderNumber: ord.orderNumber,
    reason,
  });

  return { success: true, returnRequestId: created?.id };
}
