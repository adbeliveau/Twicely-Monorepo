'use server';

import { authorize, sub } from '@twicely/casl';
import { markOrderShipped, cancelOrder as cancelOrderLogic, markOrderDelivered, type Carrier } from '@twicely/commerce/shipping';
import { shipOrderSchema, cancelOrderSchema, confirmDeliverySchema } from '@/lib/validations/order-actions';

interface ShipOrderResult {
  success: boolean;
  shipmentId?: string;
  isLate?: boolean;
  error?: string;
}

interface CancelOrderResult {
  success: boolean;
  error?: string;
}

interface ConfirmDeliveryResult {
  success: boolean;
  error?: string;
}

/**
 * Ship an order (server action).
 * Validates tracking number and carrier, then calls markOrderShipped.
 */
export async function shipOrder(
  orderId: string,
  carrier: string,
  trackingNumber: string
): Promise<ShipOrderResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('Order', { sellerId: userId }))) {
    return { success: false, error: 'You do not have permission to ship orders' };
  }

  const parsed = shipOrderSchema.safeParse({ orderId, carrier, trackingNumber: trackingNumber.trim() });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  return await markOrderShipped(orderId, userId, parsed.data.carrier as Carrier, parsed.data.trackingNumber);
}

/**
 * Cancel an order (server action).
 * Validates reason and calls cancelOrder.
 */
export async function cancelOrderAction(
  orderId: string,
  reason: string
): Promise<CancelOrderResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('Order', { sellerId: userId }))) {
    return { success: false, error: 'You do not have permission to cancel orders' };
  }

  const parsed = cancelOrderSchema.safeParse({ orderId, reason: reason.trim() });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  return await cancelOrderLogic(orderId, userId, parsed.data.reason);
}

/**
 * Confirm delivery of an order (server action).
 */
export async function confirmDelivery(orderId: string): Promise<ConfirmDeliveryResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', sub('Order', { buyerId: session.userId }))) {
    return { success: false, error: 'You do not have permission to confirm delivery' };
  }

  const parsed = confirmDeliverySchema.safeParse({ orderId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  return await markOrderDelivered(orderId, session.userId);
}
