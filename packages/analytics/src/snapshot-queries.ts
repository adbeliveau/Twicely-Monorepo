/**
 * @twicely/analytics — Snapshot Queries
 *
 * Canonical 15 Section 10: Read queries for metric snapshots.
 * Dashboards read snapshots for fast KPI rendering.
 */

import { db } from '@twicely/db';
import { metricSnapshot } from '@twicely/db/schema';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import type { SnapshotPeriod, MetricSnapshotRow } from './types';

/**
 * Get the latest snapshot for a given metric key.
 */
export async function getLatestSnapshot(
  metricKey: string,
): Promise<MetricSnapshotRow | null> {
  const [row] = await db
    .select({
      metricKey:   metricSnapshot.metricKey,
      period:      metricSnapshot.period,
      periodStart: metricSnapshot.periodStart,
      periodEnd:   metricSnapshot.periodEnd,
      valueCents:  metricSnapshot.valueCents,
      valueCount:  metricSnapshot.valueCount,
      valueRate:   metricSnapshot.valueRate,
      computedAt:  metricSnapshot.computedAt,
    })
    .from(metricSnapshot)
    .where(eq(metricSnapshot.metricKey, metricKey))
    .orderBy(desc(metricSnapshot.periodStart))
    .limit(1);

  return row ?? null;
}

/**
 * Get snapshot time series for a metric within a date range.
 * Returns snapshots ordered by periodStart ascending.
 */
export async function getSnapshotTimeSeries(
  metricKey: string,
  period: SnapshotPeriod,
  startDate: Date,
  endDate: Date,
): Promise<MetricSnapshotRow[]> {
  return db
    .select({
      metricKey:   metricSnapshot.metricKey,
      period:      metricSnapshot.period,
      periodStart: metricSnapshot.periodStart,
      periodEnd:   metricSnapshot.periodEnd,
      valueCents:  metricSnapshot.valueCents,
      valueCount:  metricSnapshot.valueCount,
      valueRate:   metricSnapshot.valueRate,
      computedAt:  metricSnapshot.computedAt,
    })
    .from(metricSnapshot)
    .where(
      and(
        eq(metricSnapshot.metricKey, metricKey),
        eq(metricSnapshot.period, period),
        gte(metricSnapshot.periodStart, startDate),
        lt(metricSnapshot.periodEnd, endDate),
      ),
    )
    .orderBy(metricSnapshot.periodStart);
}

/**
 * Get latest snapshots for multiple metrics at once.
 * Returns a map of metricKey -> latest snapshot.
 */
export async function getLatestSnapshots(
  metricKeys: string[],
): Promise<Map<string, MetricSnapshotRow>> {
  const result = new Map<string, MetricSnapshotRow>();

  for (const key of metricKeys) {
    const snapshot = await getLatestSnapshot(key);
    if (snapshot) {
      result.set(key, snapshot);
    }
  }

  return result;
}

/**
 * Get daily dashboard KPIs — latest snapshot for each of the core daily metrics.
 */
export async function getDailyDashboardKpis(): Promise<Map<string, MetricSnapshotRow>> {
  const dailyMetrics = [
    'gmv.daily',
    'orders.count.daily',
    'orders.aov.daily',
    'users.new.daily',
    'users.new_sellers.daily',
    'listings.active.daily',
    'listings.new.daily',
    'fee_revenue.daily',
    'take_rate.daily',
    'search.count.daily',
    'refund_rate.daily',
    'dispute_rate.daily',
  ];

  return getLatestSnapshots(dailyMetrics);
}
