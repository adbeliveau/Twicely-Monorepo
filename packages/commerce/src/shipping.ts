import { db } from '@twicely/db';
import { order, shipment, address } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

// Re-export extracted modules
export { markOrderCompleted, autoCompleteDeliveredOrders } from './order-completion';
export { cancelOrder } from './order-cancel';

export type Carrier = 'USPS' | 'UPS' | 'FEDEX' | 'OTHER';

interface MarkOrderShippedResult { success: boolean; shipmentId?: string; isLate?: boolean; error?: string }
interface MarkOrderDeliveredResult { success: boolean; error?: string }

/**
 * Mark an order as shipped (business logic - NOT a server action).
 * Creates shipment record and updates order status to SHIPPED.
 * Checks for late shipment based on expectedShipByAt.
 */
export async function markOrderShipped(
  orderId: string,
  sellerId: string,
  carrier: Carrier,
  trackingNumber: string
): Promise<MarkOrderShippedResult> {
  // Verify order exists, belongs to seller, and is PAID
  const [orderData] = await db
    .select({
      id: order.id,
      status: order.status,
      sellerId: order.sellerId,
      buyerId: order.buyerId,
      orderNumber: order.orderNumber,
      expectedShipByAt: order.expectedShipByAt,
      shippingAddressJson: order.shippingAddressJson,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!orderData) {
    return { success: false, error: 'Order not found' };
  }

  if (orderData.sellerId !== sellerId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (orderData.status !== 'PAID') {
    return { success: false, error: 'Order must be in PAID status to ship' };
  }

  // Get seller's default address for fromAddressJson
  const [sellerAddress] = await db
    .select()
    .from(address)
    .where(and(eq(address.userId, sellerId), eq(address.isDefault, true)))
    .limit(1);

  const fromAddressJson = sellerAddress
    ? {
        name: sellerAddress.name,
        address1: sellerAddress.address1,
        address2: sellerAddress.address2,
        city: sellerAddress.city,
        state: sellerAddress.state,
        zip: sellerAddress.zip,
        country: sellerAddress.country,
        phone: sellerAddress.phone,
      }
    : {};

  const now = new Date();
  const isLate = orderData.expectedShipByAt ? now > orderData.expectedShipByAt : false;

  try {
    // Create shipment and update order in transaction
    const result = await db.transaction(async (tx) => {
      // Create shipment record
      const [newShipment] = await tx
        .insert(shipment)
        .values({
          orderId,
          carrier,
          tracking: trackingNumber,
          status: 'PICKED_UP',
          fromAddressJson,
          toAddressJson: orderData.shippingAddressJson,
          lateShipment: isLate,
          shippedAt: now,
        })
        .returning({ id: shipment.id });

      if (!newShipment) {
        throw new Error('Failed to create shipment');
      }

      // Update order
      await tx
        .update(order)
        .set({
          status: 'SHIPPED',
          trackingNumber,
          carrierCode: carrier,
          shippedAt: now,
          isLateShipment: isLate,
          updatedAt: now,
        })
        .where(eq(order.id, orderId));

      return { shipmentId: newShipment.id };
    });

    // Notify buyer that order has shipped
    await notify(orderData.buyerId, 'order.shipped', {
      orderNumber: orderData.orderNumber,
      trackingNumber,
      carrier,
    });

    return {
      success: true,
      shipmentId: result.shipmentId,
      isLate,
    };
  } catch (error) {
    logger.error('Failed to mark order as shipped', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to ship order',
    };
  }
}

/**
 * Mark an order as delivered (business logic - NOT a server action).
 * Only works if order is in SHIPPED status.
 */
export async function markOrderDelivered(
  orderId: string,
  userId: string
): Promise<MarkOrderDeliveredResult> {
  // Get order to check status and verify user is buyer or seller
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

  // Verify user is either buyer or seller
  if (orderData.buyerId !== userId && orderData.sellerId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Can only mark as delivered if currently SHIPPED
  if (orderData.status !== 'SHIPPED') {
    return { success: false, error: 'Order must be in SHIPPED status to mark as delivered' };
  }

  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      // Update order status
      await tx
        .update(order)
        .set({
          status: 'DELIVERED',
          deliveredAt: now,
          updatedAt: now,
        })
        .where(eq(order.id, orderId));

      // Update shipment status
      await tx
        .update(shipment)
        .set({
          status: 'DELIVERED',
          deliveredAt: now,
          updatedAt: now,
        })
        .where(eq(shipment.orderId, orderId));
    });

    // Notify buyer that order has been delivered
    await notify(orderData.buyerId, 'order.delivered', {
      orderNumber: orderData.orderNumber,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to mark order as delivered', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark order as delivered',
    };
  }
}
