/**
 * Nightly finance intelligence layer projection compute job.
 * Financial Center Canonical §6 — runs at 02:00 UTC daily.
 *
 * Processes all Finance PRO sellers in batches of 50.
 * Upserts results into financialProjection (ON CONFLICT on sellerProfileId).
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import {
  sellerProfile,
  financialProjection,
  order,
  orderItem,
  listing,
  expense,
} from '@twicely/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { ProjectionInput, ProjectionConfig, OrderSummary, ExpenseSummary, ListingSummary } from '@twicely/finance/projection-types';
import { computeProjection } from '@twicely/finance/projection-engine';

const QUEUE_NAME = 'finance-projection-compute';

interface ProjectionJobData {
  triggeredAt: string;
}

export const financeProjectionQueue = createQueue<ProjectionJobData>(QUEUE_NAME);

export async function registerFinanceProjectionComputeJob(): Promise<void> {
  const pattern = await getPlatformSetting(
    'jobs.cron.financeProjectionCompute.pattern',
    '0 2 * * *',
  );
  await financeProjectionQueue.add(
    'finance-projection-compute',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'finance-projection-compute',
      repeat: { pattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
  logger.info('[financeProjectionCompute] Registered finance projection compute job');
}

export interface ProjectionComputeResult {
  processed: number;
  errors: number;
}

export async function processFinanceProjectionCompute(): Promise<ProjectionComputeResult> {
  const result: ProjectionComputeResult = { processed: 0, errors: 0 };
  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  // All configurable values from platform_settings — no hardcoded business constants
  const [BATCH_SIZE, trailingDays, breakEvenMinMonths] = await Promise.all([
    getPlatformSetting<number>('finance.projection.batchSize', 50),
    getPlatformSetting<number>('finance.projection.trailingDays', 90),
    getPlatformSetting<number>('finance.projection.breakEvenMinMonths', 3),
  ]);
  const projectionConfig: ProjectionConfig = { trailingDays, breakEvenMinMonths };

  let offset = 0;
  while (true) {
    const profiles = await db
      .select({
        id: sellerProfile.id,
        userId: sellerProfile.userId,
        createdAt: sellerProfile.createdAt,
      })
      .from(sellerProfile)
      .where(eq(sellerProfile.financeTier, 'PRO'))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (profiles.length === 0) break;

    for (const profile of profiles) {
      try {
        // Fetch orders (12 months)
        const orderRows = await db
          .select({
            id: order.id,
            totalCents: order.totalCents,
            completedAt: order.completedAt,
          })
          .from(order)
          .where(
            and(
              eq(order.sellerId, profile.userId),
              eq(order.status, 'COMPLETED'),
              gte(order.completedAt, twelveMonthsAgo),
            ),
          );

        // Fetch COGS + listing activation for each order via orderItem + listing
        const orderSummaries: OrderSummary[] = await Promise.all(
          orderRows.map(async (o) => {
            const items = await db
              .select({
                cogsCents: listing.cogsCents,
                activatedAt: listing.activatedAt,
                categoryId: listing.categoryId,
              })
              .from(orderItem)
              .innerJoin(listing, eq(listing.id, orderItem.listingId))
              .where(eq(orderItem.orderId, o.id));

            const cogsCents = items.reduce((s, i) => s + (i.cogsCents ?? 0), 0);
            const firstItem = items[0];
            return {
              id: o.id,
              totalCents: o.totalCents,
              tfFeesCents: 0,
              stripeFeesCents: 0,
              shippingCostsCents: 0,
              cogsCents,
              completedAt: o.completedAt!,
              listingActivatedAt: firstItem?.activatedAt ?? null,
              categoryId: firstItem?.categoryId ?? null,
            };
          }),
        );

        // Fetch expenses (12 months)
        const expenseRows = await db
          .select({
            id: expense.id,
            amountCents: expense.amountCents,
            category: expense.category,
            expenseDate: expense.expenseDate,
          })
          .from(expense)
          .where(
            and(
              eq(expense.userId, profile.userId),
              gte(expense.expenseDate, twelveMonthsAgo),
            ),
          );

        const expenses: ExpenseSummary[] = expenseRows.map((e) => ({
          id: e.id,
          amountCents: e.amountCents,
          category: e.category,
          expenseDate: e.expenseDate,
        }));

        // Fetch active listings
        const activeRows = await db
          .select({
            id: listing.id,
            priceCents: listing.priceCents,
            cogsCents: listing.cogsCents,
            status: listing.status,
            activatedAt: listing.activatedAt,
          })
          .from(listing)
          .where(
            and(
              eq(listing.ownerUserId, profile.userId),
              eq(listing.status, 'ACTIVE'),
            ),
          );

        const activeListings: ListingSummary[] = activeRows.map((l) => ({
          id: l.id,
          priceCents: l.priceCents,
          cogsCents: l.cogsCents,
          status: l.status,
          activatedAt: l.activatedAt,
        }));

        const input: ProjectionInput = {
          sellerProfileId: profile.id,
          accountCreatedAt: profile.createdAt,
          orders: orderSummaries,
          expenses,
          activeListings,
        };

        const output = await computeProjection(input, projectionConfig);

        // Upsert into financialProjection
        await db
          .insert(financialProjection)
          .values({
            sellerProfileId: profile.id,
            projectedRevenue30dCents: output.projectedRevenue30dCents,
            projectedExpenses30dCents: output.projectedExpenses30dCents,
            projectedProfit30dCents: output.projectedProfit30dCents,
            sellThroughRate90d: output.sellThroughRate90d,
            avgSalePrice90dCents: output.avgSalePrice90dCents,
            effectiveFeeRate90d: output.effectiveFeeRate90d,
            avgDaysToSell90d: output.avgDaysToSell90d,
            breakEvenRevenueCents: output.breakEvenRevenueCents,
            breakEvenOrders: output.breakEvenOrders,
            healthScore: output.healthScore,
            healthScoreBreakdownJson: output.healthScoreBreakdownJson,
            inventoryTurnsPerMonth: output.inventoryTurnsPerMonth,
            performingPeriodsJson: output.performingPeriodsJson,
            dataQualityScore: output.dataQualityScore,
            computedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: financialProjection.sellerProfileId,
            set: {
              projectedRevenue30dCents: output.projectedRevenue30dCents,
              projectedExpenses30dCents: output.projectedExpenses30dCents,
              projectedProfit30dCents: output.projectedProfit30dCents,
              sellThroughRate90d: output.sellThroughRate90d,
              avgSalePrice90dCents: output.avgSalePrice90dCents,
              effectiveFeeRate90d: output.effectiveFeeRate90d,
              avgDaysToSell90d: output.avgDaysToSell90d,
              breakEvenRevenueCents: output.breakEvenRevenueCents,
              breakEvenOrders: output.breakEvenOrders,
              healthScore: output.healthScore,
              healthScoreBreakdownJson: output.healthScoreBreakdownJson,
              inventoryTurnsPerMonth: output.inventoryTurnsPerMonth,
              performingPeriodsJson: output.performingPeriodsJson,
              dataQualityScore: output.dataQualityScore,
              computedAt: new Date(),
            },
          });

        result.processed++;
      } catch (err) {
        logger.error('[financeProjectionCompute] Error processing profile', {
          sellerProfileId: profile.id,
          err,
        });
        result.errors++;
      }
    }

    if (profiles.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  logger.info('[financeProjectionCompute] Complete', { processed: result.processed, errors: result.errors });
  return result;
}

export function createFinanceProjectionWorker() {
  return createWorker<ProjectionJobData>(
    QUEUE_NAME,
    async () => {
      await processFinanceProjectionCompute();
    },
    1,
  );
}

// ─── Auto-instantiated worker ────────────────────────────────────────────────

void (async () => {
  createFinanceProjectionWorker();
})();
