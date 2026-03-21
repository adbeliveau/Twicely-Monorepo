/**
 * Buyer order queries
 */

import { db } from '@twicely/db';
import { order } from '@twicely/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { fetchOrderItemSummaries } from './order-helpers';
import type { BuyerOrderSummary, PaginatedResult } from './orders-types';

export async function getBuyerOrders(
  userId: string,
  filters?: {
    status?: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELED';
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResult<BuyerOrderSummary>> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Build status filter
  let statusFilter = eq(order.buyerId, userId);
  if (filters?.status === 'ACTIVE') {
    statusFilter = and(
      eq(order.buyerId, userId),
      or(eq(order.status, 'PAID'), eq(order.status, 'SHIPPED'))
    )!;
  } else if (filters?.status === 'COMPLETED') {
    statusFilter = and(
      eq(order.buyerId, userId),
      or(eq(order.status, 'DELIVERED'), eq(order.status, 'COMPLETED'))
    )!;
  } else if (filters?.status === 'CANCELED') {
    statusFilter = and(eq(order.buyerId, userId), eq(order.status, 'CANCELED'))!;
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(order)
    .where(statusFilter);
  const count = countResult[0]?.count ?? 0;

  // Get orders with first item
  const orders = await db
    .select({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(statusFilter)
    .orderBy(desc(order.createdAt))
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

  // Get first item + thumbnail for each order
  const { firstItemMap, itemCountMap, imageMap } = await fetchOrderItemSummaries(orderIds);

  // Build result
  const result: BuyerOrderSummary[] = orders.map((o) => {
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
