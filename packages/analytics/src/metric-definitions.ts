/**
 * @twicely/analytics — Metric Definitions
 *
 * Canonical 15 Section 15: Authoritative metric registry.
 * 15 metric definitions that drive snapshot computation.
 * seedMetricDefinitions() upserts all definitions into metricDefinition table.
 */

import { db } from '@twicely/db';
import { metricDefinition } from '@twicely/db/schema';
import { logger } from '@twicely/logger';
import type { MetricDefinitionInput } from './types';

/** All 15 metric definitions per Canonical 15 Section 15.1. */
export const METRIC_DEFINITIONS: MetricDefinitionInput[] = [
  { key: 'gmv.daily',               name: 'Daily GMV',          description: 'Sum of order.totalCents for COMPLETED/DELIVERED orders in day', unit: 'cents',  period: 'DAILY' },
  { key: 'gmv.hourly',              name: 'Hourly GMV',         description: 'Sum of order.totalCents for COMPLETED/DELIVERED orders in hour', unit: 'cents',  period: 'HOURLY' },
  { key: 'orders.count.daily',      name: 'Daily Orders',       description: 'Count of orders created in day (non-canceled)',                  unit: 'count',  period: 'DAILY' },
  { key: 'orders.count.hourly',     name: 'Hourly Orders',      description: 'Count of orders created in hour (non-canceled)',                 unit: 'count',  period: 'HOURLY' },
  { key: 'orders.aov.daily',        name: 'Daily AOV',          description: 'Average order value (GMV / order count) in day',                unit: 'cents',  period: 'DAILY' },
  { key: 'users.new.daily',         name: 'New Users Daily',    description: 'Count of users created in day',                                 unit: 'count',  period: 'DAILY' },
  { key: 'users.new_sellers.daily', name: 'New Sellers Daily',  description: 'Count of users with isSeller=true created in day',              unit: 'count',  period: 'DAILY' },
  { key: 'listings.active.daily',   name: 'Active Listings',    description: 'Count of listings with status=ACTIVE at end of day',            unit: 'count',  period: 'DAILY' },
  { key: 'listings.new.daily',      name: 'New Listings Daily', description: 'Count of listings created in day',                              unit: 'count',  period: 'DAILY' },
  { key: 'fee_revenue.daily',       name: 'Daily Fee Revenue',  description: 'Sum of ABS(ledgerEntry.amountCents) for PLATFORM_FEE_TYPES',    unit: 'cents',  period: 'DAILY' },
  { key: 'take_rate.daily',         name: 'Daily Take Rate',    description: 'fee_revenue / GMV * 10000 in basis points',                     unit: 'bps',    period: 'DAILY' },
  { key: 'search.count.daily',      name: 'Daily Searches',     description: 'Count of search.query analytics events in day',                 unit: 'count',  period: 'DAILY' },
  { key: 'search.count.hourly',     name: 'Hourly Searches',    description: 'Count of search.query analytics events in hour',                unit: 'count',  period: 'HOURLY' },
  { key: 'refund_rate.daily',       name: 'Daily Refund Rate',  description: 'Refunded orders / paid orders in day',                          unit: 'rate',   period: 'DAILY' },
  { key: 'dispute_rate.daily',      name: 'Daily Dispute Rate', description: 'Disputes opened / paid orders in day',                          unit: 'rate',   period: 'DAILY' },
];

/**
 * Seed all metric definitions into the metricDefinition table.
 * Uses upsert (ON CONFLICT on key DO UPDATE) so it is safe to run repeatedly.
 * Returns the number of definitions upserted.
 */
export async function seedMetricDefinitions(): Promise<number> {
  let count = 0;
  for (const def of METRIC_DEFINITIONS) {
    await db.insert(metricDefinition).values({
      key:         def.key,
      name:        def.name,
      description: def.description ?? null,
      unit:        def.unit,
      period:      def.period,
      isActive:    def.isActive ?? true,
    }).onConflictDoUpdate({
      target: metricDefinition.key,
      set: {
        name:        def.name,
        description: def.description ?? null,
        unit:        def.unit,
        period:      def.period,
        isActive:    def.isActive ?? true,
        updatedAt:   new Date(),
      },
    });
    count++;
  }

  logger.info('analytics.metric_definitions.seeded', { count });
  return count;
}

/**
 * Get all active metric definitions from the DB.
 */
export async function getActiveMetricDefinitions(): Promise<MetricDefinitionInput[]> {
  const { eq } = await import('drizzle-orm');
  const rows = await db.select({
    key:         metricDefinition.key,
    name:        metricDefinition.name,
    description: metricDefinition.description,
    unit:        metricDefinition.unit,
    period:      metricDefinition.period,
    isActive:    metricDefinition.isActive,
  }).from(metricDefinition)
    .where(eq(metricDefinition.isActive, true));

  return rows.map((r) => ({
    key:         r.key,
    name:        r.name,
    description: r.description ?? undefined,
    unit:        r.unit as MetricDefinitionInput['unit'],
    period:      r.period as MetricDefinitionInput['period'],
    isActive:    r.isActive,
  }));
}
