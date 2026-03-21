/**
 * Order detail queries — getOrderDetail, getOrderItems
 */

import { db } from '@twicely/db';
import { order, orderItem, orderPayment, listingImage, user, sellerProfile, shipment } from '@twicely/db/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import type { OrderDetailData } from './orders-types';

// Get order detail (for both buyer and seller)
export async function getOrderDetail(
  orderId: string,
  userId: string
): Promise<OrderDetailData | null> {
  const [orderData] = await db
    .select()
    .from(order)
    .where(
      and(
        eq(order.id, orderId),
        or(eq(order.buyerId, userId), eq(order.sellerId, userId))
      )
    )
    .limit(1);

  if (!orderData) {
    return null;
  }

  // Get order items
  const items = await getOrderItems(orderId);

  // Get shipment if exists
  const [shipmentData] = await db
    .select({
      id: shipment.id,
      tracking: shipment.tracking,
      carrier: shipment.carrier,
      status: shipment.status,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
    })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
    .limit(1);

  // Get buyer info
  const [buyerData] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, orderData.buyerId))
    .limit(1);

  // Get seller info
  const [sellerData] = await db
    .select({
      name: user.name,
      storeName: sellerProfile.storeName,
    })
    .from(user)
    .leftJoin(sellerProfile, eq(user.id, sellerProfile.userId))
    .where(eq(user.id, orderData.sellerId))
    .limit(1);

  // v3.2: Get payment info for fee breakdown
  const [paymentData] = await db
    .select({
      tfAmountCents: orderPayment.tfAmountCents,
      stripeFeesCents: orderPayment.stripeFeesCents,
    })
    .from(orderPayment)
    .where(eq(orderPayment.orderId, orderId))
    .limit(1);

  return {
    order: {
      id: orderData.id,
      orderNumber: orderData.orderNumber,
      status: orderData.status,
      totalCents: orderData.totalCents,
      itemSubtotalCents: orderData.itemSubtotalCents,
      shippingCents: orderData.shippingCents,
      taxCents: orderData.taxCents,
      discountCents: orderData.discountCents,
      tfAmountCents: paymentData?.tfAmountCents ?? null,
      stripeFeesCents: paymentData?.stripeFeesCents ?? null,
      createdAt: orderData.createdAt,
      paidAt: orderData.paidAt,
      shippedAt: orderData.shippedAt,
      deliveredAt: orderData.deliveredAt,
      trackingNumber: orderData.trackingNumber,
      carrierCode: orderData.carrierCode,
      shippingAddressJson: orderData.shippingAddressJson,
      buyerNote: orderData.buyerNote,
      isGift: orderData.isGift,
      giftMessage: orderData.giftMessage,
      buyerId: orderData.buyerId,
      sellerId: orderData.sellerId,
      isLateShipment: orderData.isLateShipment,
      expectedShipByAt: orderData.expectedShipByAt,
      cancelReason: orderData.cancelReason,
      cancelInitiator: orderData.cancelInitiator,
      isLocalPickup: orderData.isLocalPickup,
      localTransactionId: orderData.localTransactionId,
      // B3.5: Authentication fields
      authenticationOffered: orderData.authenticationOffered,
      authenticationDeclined: orderData.authenticationDeclined,
      authenticationDeclinedAt: orderData.authenticationDeclinedAt,
      authenticationRequestId: orderData.authenticationRequestId,
    },
    items,
    shipment: shipmentData ?? null,
    buyer: {
      name: buyerData?.name ?? 'Unknown',
    },
    seller: {
      name: sellerData?.name ?? 'Unknown',
      storeName: sellerData?.storeName ?? null,
    },
  };
}

// Get order items with images
export async function getOrderItems(orderId: string) {
  const items = await db
    .select({
      id: orderItem.id,
      listingId: orderItem.listingId,
      title: orderItem.title,
      quantity: orderItem.quantity,
      unitPriceCents: orderItem.unitPriceCents,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId));

  if (items.length === 0) {
    return [];
  }

  // Get images for all items using inArray
  const listingIds = items.map((item) => item.listingId);
  const images = await db
    .select({
      listingId: listingImage.listingId,
      url: listingImage.url,
    })
    .from(listingImage)
    .where(
      and(
        eq(listingImage.isPrimary, true),
        inArray(listingImage.listingId, listingIds)
      )
    );

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  return items.map((item) => ({
    id: item.id,
    listingId: item.listingId,
    title: item.title,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    imageUrl: imageMap.get(item.listingId) ?? null,
  }));
}
