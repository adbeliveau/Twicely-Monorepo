/**
 * Daily buyer quality tier recalculation BullMQ job.
 * Runs at 3:30 AM UTC (offset from seller-score-recalc at 3 AM).
 *
 * Queries all users with recent order activity (trailing 90 days),
 * computes buyer quality tier via computeBuyerQuality(),
 * and updates user.buyerQualityTier in the database.
 *
 * See packages/commerce/src/buyer-quality.ts for tier logic (C1.3).
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { user, order, returnRequest, dispute } from '@twicely/db/schema';
import { eq, and, gte, count, sql } from 'drizzle-orm';
import { computeBuyerQuality, type BuyerMetrics } from '@twicely/commerce/buyer-quality';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'buyer-quality-recalc';
const WINDOW_DAYS = 90;

interface RecalcJobData {
  triggeredAt: string;
}

export const buyerQualityRecalcQueue = createQueue<RecalcJobData>(QUEUE_NAME);

/** Register the daily buyer quality recalculation job. Call once at startup. */
export async function registerBuyerQualityRecalcJob(): Promise<void> {
  await buyerQualityRecalcQueue.add(
    'buyer-quality-recalc-daily',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'buyer-quality-recalc-daily',
      repeat: { pattern: '30 3 * * *' }, // Daily at 3:30 AM UTC
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
  logger.info('[buyerQualityRecalc] Registered daily recalc job');
}

/** Fetch buyer quality metrics for a single user. */
async function fetchBuyerMetrics(buyerId: string): Promise<BuyerMetrics> {
  const ninetyDaysAgo = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [orderStats, returnStats, disputeStats] = await Promise.all([
    db.select({
      total: count(),
      canceled: sql<number>`COUNT(*) FILTER (WHERE ${order.status} = 'CANCELED' AND ${order.cancelInitiator} = 'BUYER')`,
    }).from(order).where(and(eq(order.buyerId, buyerId), gte(order.createdAt, ninetyDaysAgo))),

    db.select({ count: count() }).from(returnRequest)
      .where(and(eq(returnRequest.buyerId, buyerId), gte(returnRequest.createdAt, ninetyDaysAgo))),

    db.select({ count: count() }).from(dispute)
      .where(and(eq(dispute.buyerId, buyerId), gte(dispute.createdAt, ninetyDaysAgo))),
  ]);

  return {
    totalOrders90d: orderStats[0]?.total ?? 0,
    returns90d: returnStats[0]?.count ?? 0,
    cancellations90d: Number(orderStats[0]?.canceled ?? 0),
    disputes90d: disputeStats[0]?.count ?? 0,
  };
}

/** Process all buyers with recent activity and update their quality tier. */
export async function processBuyerQualityRecalc(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Find distinct buyers who placed orders in the last 90 days
  const activeBuyers = await db
    .selectDistinct({ buyerId: order.buyerId })
    .from(order)
    .where(gte(order.createdAt, ninetyDaysAgo));

  logger.info('[buyerQualityRecalc] Starting recalc', { buyerCount: activeBuyers.length });

  let updated = 0;
  let errors = 0;

  for (const { buyerId } of activeBuyers) {
    try {
      const metrics = await fetchBuyerMetrics(buyerId);
      const result = await computeBuyerQuality(metrics);

      // Only update if tier has changed
      const [current] = await db
        .select({ tier: user.buyerQualityTier })
        .from(user)
        .where(eq(user.id, buyerId))
        .limit(1);

      if (current && current.tier !== result.tier) {
        await db
          .update(user)
          .set({ buyerQualityTier: result.tier, updatedAt: new Date() })
          .where(eq(user.id, buyerId));
        updated++;
      }
    } catch (err) {
      logger.error('[buyerQualityRecalc] Error processing buyer', { buyerId, err });
      errors++;
    }
  }

  logger.info('[buyerQualityRecalc] Complete', {
    buyerCount: activeBuyers.length,
    updated,
    errors,
  });
}

export const buyerQualityRecalcWorker = createWorker<RecalcJobData>(
  QUEUE_NAME,
  async () => { await processBuyerQualityRecalc(); },
  1,
);
