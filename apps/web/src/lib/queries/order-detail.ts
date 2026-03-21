import { db } from '@twicely/db';
import { order, orderItem, listingImage } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface OrderItemData {
  id: string;
  listingId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  primaryImageUrl: string | null;
}

export interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  buyerId: string;
  sellerId: string;
  itemSubtotalCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  shippingAddressJson: Record<string, unknown>;
  paidAt: Date | null;
  expectedDeliveryAt: Date | null;
  createdAt: Date;
  items: OrderItemData[];
}

/**
 * Get order by ID for the given user (buyer only)
 */
export async function getOrderById(
  orderId: string,
  userId: string
): Promise<OrderDetailData | null> {
  const [orderRow] = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      itemSubtotalCents: order.itemSubtotalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      currency: order.currency,
      shippingAddressJson: order.shippingAddressJson,
      paidAt: order.paidAt,
      expectedDeliveryAt: order.expectedDeliveryAt,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.buyerId, userId)));

  if (!orderRow) return null;

  const items = await getOrderItems(orderId);

  return {
    ...orderRow,
    shippingAddressJson: orderRow.shippingAddressJson as Record<string, unknown>,
    items,
  };
}

/**
 * Get all orders for a given paymentIntentId (for 3DS redirect handling)
 */
export async function getOrdersByPaymentIntent(
  paymentIntentId: string
): Promise<{ id: string; buyerId: string; status: string }[]> {
  return db
    .select({
      id: order.id,
      buyerId: order.buyerId,
      status: order.status,
    })
    .from(order)
    .where(eq(order.paymentIntentId, paymentIntentId));
}

/**
 * Get order items with primary image
 */
async function getOrderItems(orderId: string): Promise<OrderItemData[]> {
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

  // Fetch primary images for all items
  const listingIds = items.map((i) => i.listingId);
  const images = listingIds.length > 0
    ? await db
        .select({
          listingId: listingImage.listingId,
          url: listingImage.url,
        })
        .from(listingImage)
        .where(and(
          eq(listingImage.isPrimary, true),
          inArray(listingImage.listingId, listingIds)
        ))
    : [];

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  return items.map((item) => ({
    ...item,
    primaryImageUrl: imageMap.get(item.listingId) ?? null,
  }));
}
