/**
 * Database queries for the 6 seller score metrics.
 * Each query covers a rolling window (default 90 days).
 * Response-time and review queries are in metric-queries-messaging.ts.
 * Seller Score Canonical Section 2.1.
 */

import { db } from '@twicely/db';
import { order, shipment, returnRequest, sellerProfile } from '@twicely/db/schema';
import { eq, and, gte, count, sql, isNotNull } from 'drizzle-orm';

export function windowStart(windowDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - windowDays);
  return d;
}

/**
 * On-time shipping rate: % of orders shipped within seller's handling time.
 */
export async function getOnTimeShippingRate(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const rows = await db
    .select({
      handlingDueAt: order.handlingDueAt,
      shippedAt: shipment.shippedAt,
    })
    .from(order)
    .innerJoin(shipment, eq(shipment.orderId, order.id))
    .where(
      and(
        eq(order.sellerId, userId),
        gte(order.createdAt, since),
        isNotNull(shipment.shippedAt),
      ),
    );

  if (rows.length === 0) return 1.0;

  const onTime = rows.filter(
    (r) => r.handlingDueAt !== null && r.shippedAt !== null
      && r.shippedAt <= r.handlingDueAt,
  );
  return onTime.length / rows.length;
}

/**
 * INAD claim rate: % of completed orders with INAD return claims.
 */
export async function getInadClaimRate(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const [completedRow] = await db
    .select({ cnt: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        gte(order.createdAt, since),
        eq(order.status, 'COMPLETED'),
      ),
    );

  const totalCompleted = Number(completedRow?.cnt ?? 0);
  if (totalCompleted === 0) return 0;

  const [inadRow] = await db
    .select({ cnt: count() })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.sellerId, userId),
        gte(returnRequest.createdAt, since),
        eq(returnRequest.reason, 'INAD'),
      ),
    );

  return Number(inadRow?.cnt ?? 0) / totalCompleted;
}

/**
 * Return rate: % of completed orders where return bucket = SELLER_FAULT.
 */
export async function getReturnRate(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const [completedRow] = await db
    .select({ cnt: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        gte(order.createdAt, since),
        eq(order.status, 'COMPLETED'),
      ),
    );

  const totalCompleted = Number(completedRow?.cnt ?? 0);
  if (totalCompleted === 0) return 0;

  const [returnRow] = await db
    .select({ cnt: count() })
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.sellerId, userId),
        gte(returnRequest.createdAt, since),
        eq(returnRequest.bucket, 'SELLER_FAULT'),
      ),
    );

  return Number(returnRow?.cnt ?? 0) / totalCompleted;
}

/**
 * Cancellation rate: % of orders cancelled by seller.
 */
export async function getCancellationRate(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const [totalRow] = await db
    .select({ cnt: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        gte(order.createdAt, since),
      ),
    );

  const total = Number(totalRow?.cnt ?? 0);
  if (total === 0) return 0;

  const [cancelRow] = await db
    .select({ cnt: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        gte(order.createdAt, since),
        eq(order.status, 'CANCELED'),
        eq(order.cancelInitiator, 'SELLER'),
      ),
    );

  return Number(cancelRow?.cnt ?? 0) / total;
}

/**
 * Primary fee bucket: fee bucket with highest order volume.
 */
export async function getPrimaryFeeBucket(
  userId: string,
  windowDays = 90,
): Promise<string> {
  const since = windowStart(windowDays);

  const rows = await db.execute(
    sql`
      SELECT l.fee_bucket, COUNT(*) as cnt
      FROM "order" o
      JOIN listing l ON l.id = ANY(
        SELECT listing_id FROM cart_item WHERE cart_id = o.source_cart_id
      )
      WHERE o.seller_id = ${userId}
        AND o.created_at >= ${since}
        AND l.fee_bucket IS NOT NULL
      GROUP BY l.fee_bucket
      ORDER BY cnt DESC
      LIMIT 1
    `,
  );

  const firstRow = rows[0] as Record<string, string> | undefined;
  return firstRow?.fee_bucket ?? 'APPAREL_ACCESSORIES';
}

/**
 * Count of completed orders in window.
 */
export async function getCompletedOrderCount(
  userId: string,
  windowDays = 90,
): Promise<number> {
  const since = windowStart(windowDays);

  const [row] = await db
    .select({ cnt: count() })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        gte(order.createdAt, since),
        eq(order.status, 'COMPLETED'),
      ),
    );

  return Number(row?.cnt ?? 0);
}

/**
 * Platform mean score: average sellerScore across active sellers with isNew = false.
 */
export async function getPlatformMeanScore(): Promise<number> {
  const [row] = await db
    .select({ avg: sql<number>`AVG(seller_score)` })
    .from(sellerProfile)
    .where(
      and(
        eq(sellerProfile.status, 'ACTIVE'),
        eq(sellerProfile.isNew, false),
      ),
    );

  return Number(row?.avg ?? 600);
}
