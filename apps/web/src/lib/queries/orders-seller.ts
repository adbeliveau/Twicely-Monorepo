/**
 * Seller order queries
 */

import { db } from '@twicely/db';
import { order, user } from '@twicely/db/schema';
import { eq, and, or, desc, inArray, sql } from 'drizzle-orm';
import { fetchOrderItemSummaries } from './order-helpers';
import type { SellerOrderSummary, PaginatedResult } from './orders-types';

export async function getSellerOrders(
  userId: string,
  filters?: {
    status?: 'AWAITING_SHIPMENT' | 'SHIPPED' | 'DELIVERED' | 'ALL' | 'CANCELED';
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResult<SellerOrderSummary>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build status filter
  let statusFilter = eq(order.sellerId, userId);
  if (filters?.status === 'AWAITING_SHIPMENT') {
    statusFilter = and(eq(order.sellerId, userId), eq(order.status, 'PAID'))!;
  } else if (filters?.status === 'SHIPPED') {
    statusFilter = and(eq(order.sellerId, userId), eq(order.status, 'SHIPPED'))!;
  } else if (filters?.status === 'DELIVERED') {
    statusFilter = and(
      eq(order.sellerId, userId),
      or(eq(order.status, 'DELIVERED'), eq(order.status, 'COMPLETED'))
    )!;
  } else if (filters?.status === 'CANCELED') {
    statusFilter = and(eq(order.sellerId, userId), eq(order.status, 'CANCELED'))!;
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(order)
    .where(statusFilter);
  const count = countResult[0]?.count ?? 0;

  // Get orders - PAID orders first, then by createdAt desc
  const orders = await db
    .select({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      buyerId: order.buyerId,
      expectedShipByAt: order.expectedShipByAt,
      isLateShipment: order.isLateShipment,
    })
    .from(order)
    .where(statusFilter)
    .orderBy(
      sql`CASE WHEN ${order.status} = 'PAID' THEN 0 ELSE 1 END`,
      desc(order.createdAt)
    )
    .limit(pageSize)
    .offset(offset);

  if (orders.length === 0) {
    return {
      items: [],
      totalCount: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    };
  }

  const orderIds = orders.map((o) => o.orderId);
  const buyerIds = orders.map((o) => o.buyerId);

  // Get first item + thumbnail for each order
  const { firstItemMap, itemCountMap, imageMap } = await fetchOrderItemSummaries(orderIds);

  // Get buyer names
  const buyers = await db
    .select({
      userId: user.id,
      name: user.name,
    })
    .from(user)
    .where(inArray(user.id, buyerIds));

  const buyerMap = new Map(buyers.map((b) => [b.userId, b.name]));

  // Build result
  const result: SellerOrderSummary[] = orders.map((o) => {
    const firstItem = firstItemMap.get(o.orderId)!;
    return {
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      firstItemThumbnail: imageMap.get(firstItem.listingId) ?? null,
      firstItemTitle: firstItem.title,
      itemCount: itemCountMap.get(o.orderId) ?? 0,
      buyerName: buyerMap.get(o.buyerId) ?? 'Unknown',
      expectedShipByAt: o.expectedShipByAt,
      isLateShipment: o.isLateShipment,
    };
  });

  return {
    items: result,
    totalCount: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  };
}
