/**
 * Return Queries
 *
 * Query functions for return request data.
 */

import { db } from '@twicely/db';
import { returnRequest, order, orderItem, listingImage } from '@twicely/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

// Return status type from enum
type ReturnStatus = 'PENDING_SELLER' | 'APPROVED' | 'DECLINED' | 'PARTIAL_OFFERED' |
  'BUYER_ACCEPTS_PARTIAL' | 'BUYER_DECLINES_PARTIAL' | 'LABEL_GENERATED' | 'SHIPPED' |
  'DELIVERED' | 'REFUND_ISSUED' | 'CONDITION_DISPUTE' | 'BUYER_ACCEPTS' | 'ESCALATED' | 'CLOSED';

export interface ReturnWithOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  evidencePhotos: string[];
  refundAmountCents: number | null;
  createdAt: Date;
  sellerResponseDueAt: Date | null;
  items: {
    title: string;
    priceCents: number;
    quantity: number;
  }[];
}

/**
 * Get return request with order details.
 */
export async function getReturnWithOrder(returnId: string): Promise<ReturnWithOrder | null> {
  const [req] = await db
    .select({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      buyerId: returnRequest.buyerId,
      sellerId: returnRequest.sellerId,
      status: returnRequest.status,
      reason: returnRequest.reason,
      description: returnRequest.description,
      evidencePhotos: returnRequest.evidencePhotos,
      refundAmountCents: returnRequest.refundAmountCents,
      createdAt: returnRequest.createdAt,
      sellerResponseDueAt: returnRequest.sellerResponseDueAt,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return null;
  }

  // Get order number
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  // Get order items
  const items = await db
    .select({
      title: orderItem.title,
      priceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, req.orderId));

  return {
    ...req,
    orderNumber: ord?.orderNumber ?? '',
    items,
  };
}

/**
 * Get pending returns for seller (needs response).
 */
export async function getPendingReturnsForSeller(sellerId: string) {
  return db
    .select({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      reason: returnRequest.reason,
      description: returnRequest.description,
      sellerResponseDueAt: returnRequest.sellerResponseDueAt,
      createdAt: returnRequest.createdAt,
    })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.sellerId, sellerId),
        eq(returnRequest.status, 'PENDING_SELLER')
      )
    )
    .orderBy(returnRequest.sellerResponseDueAt);
}

/**
 * Get return counts by status for seller.
 */
export async function getReturnCountsBySeller(sellerId: string): Promise<Record<ReturnStatus, number>> {
  const returns = await db
    .select({ status: returnRequest.status })
    .from(returnRequest)
    .where(eq(returnRequest.sellerId, sellerId));

  const counts: Partial<Record<ReturnStatus, number>> = {};
  for (const r of returns) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  return counts as Record<ReturnStatus, number>;
}

/**
 * Get return counts by status for buyer.
 */
export async function getReturnCountsByBuyer(buyerId: string): Promise<Record<ReturnStatus, number>> {
  const returns = await db
    .select({ status: returnRequest.status })
    .from(returnRequest)
    .where(eq(returnRequest.buyerId, buyerId));

  const counts: Partial<Record<ReturnStatus, number>> = {};
  for (const r of returns) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  return counts as Record<ReturnStatus, number>;
}

/**
 * Get all returns for an order.
 */
export async function getReturnsForOrder(orderId: string) {
  return db
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.orderId, orderId))
    .orderBy(desc(returnRequest.createdAt));
}

/**
 * Check if order has an active return.
 */
export async function hasActiveReturn(orderId: string): Promise<boolean> {
  const activeStatuses: ReturnStatus[] = [
    'PENDING_SELLER',
    'APPROVED',
    'LABEL_GENERATED',
    'SHIPPED',
    'DELIVERED',
    'PARTIAL_OFFERED',
    'ESCALATED',
    'CONDITION_DISPUTE',
  ];

  const [active] = await db
    .select({ id: returnRequest.id })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.orderId, orderId),
        inArray(returnRequest.status, activeStatuses)
      )
    )
    .limit(1);

  return !!active;
}

/**
 * Get detailed return information for buyer view.
 */
export interface ReturnDetails {
  id: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  photos: string[];
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  sellerResponse: string | null;
  respondedAt: Date | null;
  refundAmountCents: number | null;
  restockingFeeCents: number | null;
  refundedAt: Date | null;
  createdAt: Date;
  disputeId: string | null;
  items: {
    id: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
    imageUrl: string | null;
  }[];
}

export async function getReturnDetails(returnId: string): Promise<ReturnDetails | null> {
  const [ret] = await db
    .select({
      id: returnRequest.id,
      status: returnRequest.status,
      reason: returnRequest.reason,
      description: returnRequest.description,
      evidencePhotos: returnRequest.evidencePhotos,
      orderId: returnRequest.orderId,
      buyerId: returnRequest.buyerId,
      sellerId: returnRequest.sellerId,
      sellerResponseNote: returnRequest.sellerResponseNote,
      sellerRespondedAt: returnRequest.sellerRespondedAt,
      refundAmountCents: returnRequest.refundAmountCents,
      restockingFeeCents: returnRequest.restockingFeeCents,
      refundedAt: returnRequest.refundedAt,
      escalatedAt: returnRequest.escalatedAt,
      createdAt: returnRequest.createdAt,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!ret) {
    return null;
  }

  // Get order number
  const [ord] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, ret.orderId))
    .limit(1);

  // Get order items with images
  const items = await db
    .select({
      id: orderItem.id,
      title: orderItem.title,
      quantity: orderItem.quantity,
      unitPriceCents: orderItem.unitPriceCents,
      listingId: orderItem.listingId,
    })
    .from(orderItem)
    .where(eq(orderItem.orderId, ret.orderId));

  // Get primary images for items
  const listingIds = items.map((i) => i.listingId);
  const images = listingIds.length > 0
    ? await db
        .select({ listingId: listingImage.listingId, url: listingImage.url })
        .from(listingImage)
        .where(and(inArray(listingImage.listingId, listingIds), eq(listingImage.isPrimary, true)))
    : [];

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  // Check if there's an associated dispute
  // For now we'll just check if it was escalated
  const disputeId = ret.escalatedAt ? 'escalated' : null;

  return {
    id: ret.id,
    status: ret.status,
    reason: ret.reason,
    description: ret.description,
    photos: ret.evidencePhotos ?? [],
    orderNumber: ord?.orderNumber ?? '',
    buyerId: ret.buyerId,
    sellerId: ret.sellerId,
    sellerResponse: ret.sellerResponseNote,
    respondedAt: ret.sellerRespondedAt,
    refundAmountCents: ret.refundAmountCents,
    restockingFeeCents: ret.restockingFeeCents,
    refundedAt: ret.refundedAt,
    createdAt: ret.createdAt,
    disputeId,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      imageUrl: imageMap.get(item.listingId) ?? null,
    })),
  };
}
