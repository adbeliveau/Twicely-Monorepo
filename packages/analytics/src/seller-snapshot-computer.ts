/**
 * @twicely/analytics — Seller Snapshot Computer
 *
 * Canonical 14, Section 4.2: Computes daily per-seller metrics
 * from orders, ledger, events, listings, and shipping data.
 * Runs nightly at 02:00 UTC via BullMQ cron.
 */

import { db } from '@twicely/db';
import {
  order, listing, ledgerEntry, analyticsEvent,
  sellerDailySnapshot, sellerPercentileBand, sellerProfile, shipment,
} from '@twicely/db/schema';
import { sql, and, eq, gte, lt, count, isNotNull } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

function dayStart(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}

function dayEnd(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(23, 59, 59, 999);
  return r;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute all daily metrics for one seller.
 */
export async function computeSellerDailySnapshot(
  sellerId: string,
  date: Date,
): Promise<void> {
  const start = dayStart(date);
  const end = dayEnd(date);

  // GMV + order count
  const [gmvRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)`,
      cnt: sql<string>`COUNT(*)`,
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, sellerId),
        sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
        gte(order.createdAt, start),
        lt(order.createdAt, end),
      ),
    );
  const gmvCents = Number(gmvRow?.total ?? 0);
  const ordersCount = Number(gmvRow?.cnt ?? 0);

  // Net revenue from ledger (ORDER_PAYMENT_CAPTURED - refunds)
  const [creditRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${ledgerEntry.amountCents}), 0)`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, sellerId),
        eq(ledgerEntry.type, 'ORDER_PAYMENT_CAPTURED'),
        eq(ledgerEntry.status, 'POSTED'),
        gte(ledgerEntry.createdAt, start),
        lt(ledgerEntry.createdAt, end),
      ),
    );
  const [refundRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)`,
      cnt: sql<string>`COUNT(DISTINCT ${ledgerEntry.orderId})`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, sellerId),
        sql`${ledgerEntry.type} IN ('REFUND_FULL', 'REFUND_PARTIAL')`,
        eq(ledgerEntry.status, 'POSTED'),
        gte(ledgerEntry.createdAt, start),
        lt(ledgerEntry.createdAt, end),
      ),
    );
  const netRevenueCents = Number(creditRow?.total ?? 0) - Number(refundRow?.total ?? 0);
  const refundsCents = Number(refundRow?.total ?? 0);
  const refundsCount = Number(refundRow?.cnt ?? 0);

  // Fees
  const feeTypes = sql`${ledgerEntry.type} IN ('ORDER_TF_FEE','ORDER_BOOST_FEE','INSERTION_FEE')`;
  const [feeRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)`,
    })
    .from(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.userId, sellerId),
        feeTypes,
        eq(ledgerEntry.status, 'POSTED'),
        gte(ledgerEntry.createdAt, start),
        lt(ledgerEntry.createdAt, end),
      ),
    );
  const totalFeesCents = Number(feeRow?.total ?? 0);

  // Views, visitors, saves from analyticsEvent
  const [viewRow] = await db
    .select({ cnt: count() })
    .from(analyticsEvent)
    .where(
      and(
        eq(analyticsEvent.eventName, 'listing.view'),
        eq(analyticsEvent.sellerId, sellerId),
        gte(analyticsEvent.occurredAt, start),
        lt(analyticsEvent.occurredAt, end),
      ),
    );
  const [visitorRow] = await db
    .select({
      cnt: sql<string>`COUNT(DISTINCT ${analyticsEvent.sessionId})`,
    })
    .from(analyticsEvent)
    .where(
      and(
        eq(analyticsEvent.sellerId, sellerId),
        isNotNull(analyticsEvent.sessionId),
        gte(analyticsEvent.occurredAt, start),
        lt(analyticsEvent.occurredAt, end),
      ),
    );
  const [saveRow] = await db
    .select({ cnt: count() })
    .from(analyticsEvent)
    .where(
      and(
        eq(analyticsEvent.eventName, 'listing.save'),
        eq(analyticsEvent.sellerId, sellerId),
        gte(analyticsEvent.occurredAt, start),
        lt(analyticsEvent.occurredAt, end),
      ),
    );

  // Listings
  const [activeRow] = await db
    .select({ cnt: count() })
    .from(listing)
    .where(and(eq(listing.ownerUserId, sellerId), eq(listing.status, 'ACTIVE')));
  const [newRow] = await db
    .select({ cnt: count() })
    .from(listing)
    .where(
      and(
        eq(listing.ownerUserId, sellerId),
        gte(listing.createdAt, start),
        lt(listing.createdAt, end),
      ),
    );

  // Shipping time
  const shipRows = await db
    .select({
      paidAt: order.paidAt,
      shippedAt: shipment.shippedAt,
      handlingDueAt: order.handlingDueAt,
    })
    .from(order)
    .innerJoin(shipment, eq(shipment.orderId, order.id))
    .where(
      and(
        eq(order.sellerId, sellerId),
        isNotNull(shipment.shippedAt),
        gte(shipment.shippedAt, start),
        lt(shipment.shippedAt, end),
      ),
    );
  let avgShipTimeMinutes: number | null = null;
  let lateShipmentsCount = 0;
  if (shipRows.length > 0) {
    let total = 0;
    for (const r of shipRows) {
      if (r.paidAt && r.shippedAt) {
        total += (r.shippedAt.getTime() - r.paidAt.getTime()) / 60000;
      }
      if (r.handlingDueAt && r.shippedAt && r.shippedAt > r.handlingDueAt) {
        lateShipmentsCount++;
      }
    }
    avgShipTimeMinutes = Math.round(total / shipRows.length);
  }

  // Score snapshot (read-only from sellerProfile)
  const [profile] = await db
    .select({
      sellerScore: sellerProfile.sellerScore,
      performanceBand: sellerProfile.performanceBand,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId));

  // Upsert
  const data = {
    sellerId,
    snapshotDate: dateStr(date),
    gmvCents,
    netRevenueCents,
    totalFeesCents,
    ordersCount,
    itemsSold: ordersCount,
    avgOrderValueCents: ordersCount > 0 ? Math.round(gmvCents / ordersCount) : 0,
    listingViews: viewRow?.cnt ?? 0,
    uniqueVisitors: Number(visitorRow?.cnt ?? 0),
    savesCount: saveRow?.cnt ?? 0,
    activeListings: activeRow?.cnt ?? 0,
    newListings: newRow?.cnt ?? 0,
    endedListings: 0,
    refundsCount,
    refundsCents,
    disputesCount: 0,
    returnsCount: 0,
    avgShipTimeMinutes,
    lateShipmentsCount,
    sellerScore: profile?.sellerScore ?? null,
    performanceBand: profile?.performanceBand ?? null,
  };

  await db
    .insert(sellerDailySnapshot)
    .values(data)
    .onConflictDoUpdate({
      target: [sellerDailySnapshot.sellerId, sellerDailySnapshot.snapshotDate],
      set: { ...data, computedAt: new Date() },
    });
}

/**
 * Run nightly for all active sellers. Canonical 14, Section 5.1.
 */
export async function runSellerDailySnapshotJob(
  date?: Date,
): Promise<{ processed: number; errors: number }> {
  const enabled = await getPlatformSetting('analytics.seller.enabled', true);
  if (!enabled) {
    logger.info('seller-daily-snapshot: disabled');
    return { processed: 0, errors: 0 };
  }

  const batchSize = await getPlatformSetting('analytics.seller.snapshotBatchSize', 50);

  const target =
    date ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    })();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  // Active sellers: have ACTIVE listing OR order in last 90 days
  const sellerRows = await db.execute(sql`
    SELECT DISTINCT seller_id FROM (
      SELECT owner_user_id AS seller_id FROM listing WHERE status = 'ACTIVE'
      UNION
      SELECT seller_id FROM "order" WHERE created_at >= ${since.toISOString()}
    ) AS active_sellers
  `);

  const sellers = sellerRows as unknown as Array<{ seller_id: string }>;
  let processed = 0;
  let errors = 0;

  // Process in batches per analytics.seller.snapshotBatchSize (Canonical 14 §5.1 step 3)
  for (let i = 0; i < sellers.length; i += batchSize) {
    const batch = sellers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((row) => computeSellerDailySnapshot(row.seller_id, target)),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        errors++;
        logger.error('seller-daily-snapshot.seller_error', {
          error: String(result.reason),
        });
      }
    }
  }

  await computePercentileBands();
  logger.info('seller-daily-snapshot.complete', {
    processed,
    errors,
    date: dateStr(target),
  });
  return { processed, errors };
}

async function computePercentileBands(): Promise<void> {
  const minOrders = await getPlatformSetting(
    'analytics.seller.percentileMinOrders',
    5,
  );
  const metrics = ['gmv', 'orders', 'score'] as const;
  const periods = [30, 60, 90] as const;

  for (const metric of metrics) {
    for (const periodDays of periods) {
      const since = new Date();
      since.setDate(since.getDate() - periodDays);
      const column =
        metric === 'gmv'
          ? 'gmv_cents'
          : metric === 'orders'
            ? 'orders_count'
            : 'seller_score';

      // Use SQL PERCENTILE_CONT for canonical-correct linear interpolation (Canonical 14 §5.3)
      const rows = await db.execute(sql`
        SELECT
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY agg_val) AS p25,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY agg_val) AS p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY agg_val) AS p75,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY agg_val) AS p90
        FROM (
          SELECT SUM(${sql.raw(column)}) AS agg_val
          FROM seller_daily_snapshot
          WHERE snapshot_date >= ${since.toISOString().slice(0, 10)}
          GROUP BY seller_id
          HAVING SUM(orders_count) >= ${minOrders}
        ) AS seller_aggs
      `);
      const pRow = (rows as unknown as Array<{ p25: string; p50: string; p75: string; p90: string }>)[0];
      if (!pRow) continue;

      const p25Value = Number(pRow.p25 ?? 0);
      const p50Value = Number(pRow.p50 ?? 0);
      const p75Value = Number(pRow.p75 ?? 0);
      const p90Value = Number(pRow.p90 ?? 0);

      await db
        .insert(sellerPercentileBand)
        .values({ metric, periodDays, p25Value, p50Value, p75Value, p90Value })
        .onConflictDoUpdate({
          target: [sellerPercentileBand.metric, sellerPercentileBand.periodDays],
          set: { p25Value, p50Value, p75Value, p90Value, computedAt: new Date() },
        });
    }
  }
}
