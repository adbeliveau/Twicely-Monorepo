/**
 * @twicely/analytics — Event Queries
 *
 * Canonical 15 Section 9: Read queries for analytics events.
 * Used by admin dashboards and reporting. Events are append-only.
 */

import { db } from '@twicely/db';
import { analyticsEvent } from '@twicely/db/schema';
import { eq, and, gte, lt, desc, count, sql } from 'drizzle-orm';
import type { EventQueryFilters, AnalyticsEventRow } from './types';

/**
 * Query analytics events with filters. Paginated via limit/offset.
 */
export async function queryEvents(filters: EventQueryFilters): Promise<AnalyticsEventRow[]> {
  const conditions = [];

  if (filters.eventName) {
    conditions.push(eq(analyticsEvent.eventName, filters.eventName));
  }
  if (filters.actorUserId) {
    conditions.push(eq(analyticsEvent.actorUserId, filters.actorUserId));
  }
  if (filters.entityType) {
    conditions.push(eq(analyticsEvent.entityType, filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(eq(analyticsEvent.entityId, filters.entityId));
  }
  if (filters.sellerId) {
    conditions.push(eq(analyticsEvent.sellerId, filters.sellerId));
  }
  if (filters.startDate) {
    conditions.push(gte(analyticsEvent.occurredAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lt(analyticsEvent.occurredAt, filters.endDate));
  }

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const query = db
    .select()
    .from(analyticsEvent)
    .orderBy(desc(analyticsEvent.occurredAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

/**
 * Count events matching a filter. Used for dashboard KPI cards.
 */
export async function countEvents(filters: Omit<EventQueryFilters, 'limit' | 'offset'>): Promise<number> {
  const conditions = [];

  if (filters.eventName) {
    conditions.push(eq(analyticsEvent.eventName, filters.eventName));
  }
  if (filters.actorUserId) {
    conditions.push(eq(analyticsEvent.actorUserId, filters.actorUserId));
  }
  if (filters.entityType) {
    conditions.push(eq(analyticsEvent.entityType, filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(eq(analyticsEvent.entityId, filters.entityId));
  }
  if (filters.sellerId) {
    conditions.push(eq(analyticsEvent.sellerId, filters.sellerId));
  }
  if (filters.startDate) {
    conditions.push(gte(analyticsEvent.occurredAt, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lt(analyticsEvent.occurredAt, filters.endDate));
  }

  const query = db
    .select({ total: count() })
    .from(analyticsEvent);

  const [result] = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return Number(result?.total ?? 0);
}

/**
 * Get distinct event names in the system. Used for filter dropdowns.
 */
export async function getDistinctEventNames(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventName: analyticsEvent.eventName })
    .from(analyticsEvent)
    .orderBy(analyticsEvent.eventName);

  return rows.map((r) => r.eventName);
}

/**
 * Get event count breakdown by event name for a date range.
 */
export async function getEventBreakdown(
  startDate: Date,
  endDate: Date,
): Promise<Array<{ eventName: string; total: number }>> {
  const rows = await db
    .select({
      eventName: analyticsEvent.eventName,
      total: count(),
    })
    .from(analyticsEvent)
    .where(
      and(
        gte(analyticsEvent.occurredAt, startDate),
        lt(analyticsEvent.occurredAt, endDate),
      ),
    )
    .groupBy(analyticsEvent.eventName)
    .orderBy(sql`count(*) desc`);

  return rows.map((r) => ({
    eventName: r.eventName,
    total: Number(r.total),
  }));
}
