/**
 * Admin Order Queries (E3.3 + I3/I4)
 * Order list, detail, payments, and enriched queries for /tx
 */

import { db } from '@twicely/db';
import { order, user, ledgerEntry, orderItem, orderPayment, dispute } from '@twicely/db/schema';
import { eq, or, ilike, count, desc, sql, and, gte, lte, inArray, isNotNull } from 'drizzle-orm';
import { escapeLike } from '@twicely/utils/escape-like';

interface OrderListItem {
  id: string;
  orderNumber: string;
  buyerName: string;
  sellerName: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  paymentStatus: string | null;
}

interface OrderListResult { orders: OrderListItem[]; total: number; }

export async function getAdminOrderList(opts: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  localPickup?: boolean;
}): Promise<OrderListResult> {
  const { page, pageSize, search, status, dateFrom, dateTo, localPickup } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    const escaped = escapeLike(search);
    conditions.push(
      or(
        ilike(order.orderNumber, `%${escaped}%`),
        sql`${order.buyerId} IN (SELECT id FROM "user" WHERE email ILIKE ${`%${escaped}%`})`,
        sql`${order.sellerId} IN (SELECT id FROM "user" WHERE email ILIKE ${`%${escaped}%`})`
      )
    );
  }
  if (status) conditions.push(eq(order.status, status as typeof order.status.enumValues[number]));
  if (dateFrom) conditions.push(gte(order.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(order.createdAt, dateTo));
  if (localPickup === true) conditions.push(eq(order.isLocalPickup, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(order).where(where);

  const rows = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(where)
    .orderBy(desc(order.createdAt))
    .limit(pageSize)
    .offset(offset);

  const userIds = [...new Set(rows.flatMap((r) => [r.buyerId, r.sellerId]))];
  const users =
    userIds.length > 0
      ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds))
      : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  // Batch-fetch payment status
  const orderIds = rows.map((r) => r.id);
  const payments =
    orderIds.length > 0
      ? await db
          .select({ orderId: orderPayment.orderId, status: orderPayment.status })
          .from(orderPayment)
          .where(inArray(orderPayment.orderId, orderIds))
      : [];
  const paymentMap = new Map(payments.map((p) => [p.orderId, p.status]));

  return {
    orders: rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      buyerName: nameMap.get(r.buyerId) ?? 'Unknown',
      sellerName: nameMap.get(r.sellerId) ?? 'Unknown',
      status: r.status,
      totalCents: r.totalCents,
      createdAt: r.createdAt,
      paymentStatus: paymentMap.get(r.id) ?? null,
    })),
    total: totalResult?.count ?? 0,
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const [row] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
  if (!row) return null;

  const entries = await db
    .select()
    .from(ledgerEntry)
    .where(eq(ledgerEntry.orderId, orderId))
    .orderBy(desc(ledgerEntry.createdAt));

  const [buyer] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, row.buyerId))
    .limit(1);
  const [seller] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, row.sellerId))
    .limit(1);

  return {
    order: row,
    buyer: buyer ?? { name: 'Unknown', email: '' },
    seller: seller ?? { name: 'Unknown', email: '' },
    ledgerEntries: entries,
  };
}

interface TxOverviewKPIs {
  orderVolume30d: number;
  paymentVolume30d: number;
  refundRate30d: number;
  avgOrderValue: number;
}

export async function getTransactionOverviewKPIs(): Promise<TxOverviewKPIs> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [orderStats] = await db
    .select({
      count: count(),
      total: sql<number>`COALESCE(SUM(${order.totalCents}), 0)`,
    })
    .from(order)
    .where(gte(order.createdAt, thirtyDaysAgo));

  const [refundStats] = await db
    .select({ count: count() })
    .from(order)
    .where(and(gte(order.createdAt, thirtyDaysAgo), eq(order.status, 'REFUNDED')));

  const orderCount = orderStats?.count ?? 0;
  const totalCents = Number(orderStats?.total ?? 0);
  const refundCount = refundStats?.count ?? 0;

  return {
    orderVolume30d: orderCount,
    paymentVolume30d: totalCents,
    refundRate30d: orderCount > 0 ? Math.round((refundCount / orderCount) * 10000) / 100 : 0,
    avgOrderValue: orderCount > 0 ? Math.round(totalCents / orderCount) : 0,
  };
}

export async function getPaymentsList(limit: number = 100) {
  return db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      status: order.status,
      paymentIntentId: order.paymentIntentId,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(isNotNull(order.paymentIntentId))
    .orderBy(desc(order.createdAt))
    .limit(limit);
}

// I4: enriched payments list from orderPayment table
export async function getEnrichedPaymentsList(opts: {
  page: number;
  pageSize: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}) {
  const { page, pageSize, status, dateFrom, dateTo, search } = opts;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) conditions.push(eq(orderPayment.status, status));
  if (dateFrom) conditions.push(gte(orderPayment.capturedAt, dateFrom));
  if (dateTo) conditions.push(lte(orderPayment.capturedAt, dateTo));
  if (search) {
    conditions.push(
      or(
        sql`${orderPayment.orderId} IN (SELECT id FROM "order" WHERE order_number ILIKE ${`%${search}%`})`,
        ilike(orderPayment.stripePaymentIntentId, `%${search}%`)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(orderPayment).where(where);

  const rows = await db
    .select()
    .from(orderPayment)
    .where(where)
    .orderBy(desc(orderPayment.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Fetch order numbers for display
  const orderIds = rows.map((r) => r.orderId);
  const orders =
    orderIds.length > 0
      ? await db
          .select({ id: order.id, orderNumber: order.orderNumber })
          .from(order)
          .where(inArray(order.id, orderIds))
      : [];
  const orderNumberMap = new Map(orders.map((o) => [o.id, o.orderNumber]));

  const enriched = rows.map((r) => ({
    ...r,
    orderNumber: orderNumberMap.get(r.orderId) ?? '—',
  }));

  return { payments: enriched, total: totalResult?.count ?? 0 };
}

// I4: payment KPIs for the payments list page
export async function getPaymentKPIs(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [captured, refunded, stripeFees, tfFees] = await Promise.all([
    db
      .select({ total: sql<number>`COALESCE(SUM(${orderPayment.amountCents}), 0)` })
      .from(orderPayment)
      .where(and(eq(orderPayment.status, 'captured'), gte(orderPayment.capturedAt, since))),
    db
      .select({ total: sql<number>`COALESCE(SUM(${orderPayment.refundAmountCents}), 0)` })
      .from(orderPayment)
      .where(and(isNotNull(orderPayment.refundedAt), gte(orderPayment.refundedAt, since))),
    db
      .select({ total: sql<number>`COALESCE(SUM(${orderPayment.stripeFeesCents}), 0)` })
      .from(orderPayment)
      .where(and(eq(orderPayment.status, 'captured'), gte(orderPayment.capturedAt, since))),
    db
      .select({ total: sql<number>`COALESCE(SUM(${orderPayment.tfAmountCents}), 0)` })
      .from(orderPayment)
      .where(and(eq(orderPayment.status, 'captured'), gte(orderPayment.capturedAt, since))),
  ]);

  return {
    capturedCents: Number(captured[0]?.total ?? 0),
    refundedCents: Number(refunded[0]?.total ?? 0),
    stripeFeeCents: Number(stripeFees[0]?.total ?? 0),
    tfCollectedCents: Number(tfFees[0]?.total ?? 0),
  };
}

// I4: order items for order detail
export async function getOrderItems(orderId: string) {
  return db
    .select()
    .from(orderItem)
    .where(eq(orderItem.orderId, orderId))
    .orderBy(orderItem.createdAt);
}

// I4: order payment for order detail
export async function getOrderPayment(orderId: string) {
  const [row] = await db
    .select()
    .from(orderPayment)
    .where(eq(orderPayment.orderId, orderId))
    .limit(1);
  return row ?? null;
}

// I4: order disputes for order detail
export async function getOrderDisputes(orderId: string) {
  return db
    .select()
    .from(dispute)
    .where(eq(dispute.orderId, orderId))
    .orderBy(desc(dispute.createdAt));
}
