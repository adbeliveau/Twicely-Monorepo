import { db } from '@twicely/db';
import { order, orderItem, listing, watchlistItem } from '@twicely/db/schema';
import { eq, and, gte, lt, count, sum, sql, desc } from 'drizzle-orm';

export interface SellerDashboardStats {
  revenue30d: number;
  revenuePrev30d: number;
  orders30d: number;
  ordersPrev30d: number;
  activeListings: number;
  draftListings: number;
  views30d: number;
  viewsPrev30d: number;
  awaitingShipmentCount: number;
}

export interface SellerRecentActivity {
  type: 'order' | 'sale' | 'watcher' | 'views';
  description: string;
  timestamp: Date;
  linkUrl: string | null;
}

/**
 * Get seller dashboard stats for the overview page
 * Returns all stats needed for the 4 dashboard cards + awaiting shipment alert
 */
export async function getSellerDashboardStats(
  sellerId: string
): Promise<SellerDashboardStats> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Revenue (30 days) - SUM of completed order items (unitPrice * quantity)
  const [revenue30dResult] = await db
    .select({ total: sum(sql`${orderItem.unitPriceCents} * ${orderItem.quantity}`) })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(
      and(
        eq(order.sellerId, sellerId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, thirtyDaysAgo)
      )
    );

  const revenue30d = Number(revenue30dResult?.total ?? 0);

  // Revenue (previous 30 days) - for % change calculation
  const [revenuePrev30dResult] = await db
    .select({ total: sum(sql`${orderItem.unitPriceCents} * ${orderItem.quantity}`) })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(
      and(
        eq(order.sellerId, sellerId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, sixtyDaysAgo),
        lt(order.completedAt, thirtyDaysAgo)
      )
    );

  const revenuePrev30d = Number(revenuePrev30dResult?.total ?? 0);

  // Orders (30 days) - COUNT of orders
  const [orders30dResult] = await db
    .select({ count: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, sellerId),
        gte(order.createdAt, thirtyDaysAgo)
      )
    );

  const orders30d = orders30dResult?.count ?? 0;

  // Orders (previous 30 days)
  const [ordersPrev30dResult] = await db
    .select({ count: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, sellerId),
        gte(order.createdAt, sixtyDaysAgo),
        lt(order.createdAt, thirtyDaysAgo)
      )
    );

  const ordersPrev30d = ordersPrev30dResult?.count ?? 0;

  // Active listings
  const [activeListingsResult] = await db
    .select({ count: count() })
    .from(listing)
    .where(
      and(
        eq(listing.ownerUserId, sellerId),
        eq(listing.status, 'ACTIVE')
      )
    );

  const activeListings = activeListingsResult?.count ?? 0;

  // Draft listings
  const [draftListingsResult] = await db
    .select({ count: count() })
    .from(listing)
    .where(
      and(
        eq(listing.ownerUserId, sellerId),
        eq(listing.status, 'DRAFT')
      )
    );

  const draftListings = draftListingsResult?.count ?? 0;

  // Views - NOTE: No listingView table exists yet, returning 0 for now
  // This will be implemented when analytics tracking is added
  const views30d = 0;
  const viewsPrev30d = 0;

  // Awaiting shipment (PAID orders past 75% of handling time)
  const [awaitingResult] = await db
    .select({ count: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, sellerId),
        eq(order.status, 'PAID'),
        sql`${order.handlingDueAt} <= ${now}`
      )
    );

  const awaitingShipmentCount = awaitingResult?.count ?? 0;

  return {
    revenue30d,
    revenuePrev30d,
    orders30d,
    ordersPrev30d,
    activeListings,
    draftListings,
    views30d,
    viewsPrev30d,
    awaitingShipmentCount,
  };
}

/**
 * Get recent activity feed for seller dashboard
 * Returns last N events merged from orders and watchlist additions
 */
export async function getSellerRecentActivity(
  sellerId: string,
  limit: number = 10
): Promise<SellerRecentActivity[]> {
  const activities: SellerRecentActivity[] = [];

  // Get recent orders (last 20 to have enough to merge)
  const recentOrders = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(eq(order.sellerId, sellerId))
    .orderBy(desc(order.createdAt))
    .limit(20);

  // Add order activities
  for (const ord of recentOrders) {
    activities.push({
      type: 'order',
      description: `New order #${ord.orderNumber}`,
      timestamp: ord.createdAt,
      linkUrl: `/my/selling/orders/${ord.id}`,
    });
  }

  // Get recent watchlist additions (seller's listings being watched)
  const recentWatchers = await db
    .select({
      listingId: watchlistItem.listingId,
      listingTitle: listing.title,
      createdAt: watchlistItem.createdAt,
    })
    .from(watchlistItem)
    .innerJoin(listing, eq(watchlistItem.listingId, listing.id))
    .where(eq(listing.ownerUserId, sellerId))
    .orderBy(desc(watchlistItem.createdAt))
    .limit(20);

  // Add watcher activities
  for (const watcher of recentWatchers) {
    activities.push({
      type: 'watcher',
      description: `Someone added "${watcher.listingTitle}" to their watchlist`,
      timestamp: watcher.createdAt,
      linkUrl: null,
    });
  }

  // Sort all activities by timestamp (most recent first) and take top N
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return activities.slice(0, limit);
}
