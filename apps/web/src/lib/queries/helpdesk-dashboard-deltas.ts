import { db } from '@twicely/db';
import { helpdeskCase, caseCsat } from '@twicely/db/schema';
import { sql, eq, and, gte, lt, isNotNull, inArray, count } from 'drizzle-orm';

export interface DashboardDeltas {
  openCasesDelta: number | null;
  resolvedTodayDelta: number | null;
  avgResponseDelta: number | null;
  slaBreachedDelta: number | null;
  csatDelta: number | null;
}

/** Get period-over-period deltas for the dashboard stat cards */
export async function getHelpdeskDashboardDeltas(): Promise<DashboardDeltas> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  sixtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    resolvedTodayResult, resolvedYesterdayResult,
    breachedTodayResult, breachedYesterdayResult,
    avgResponseCurrentResult, avgResponsePrevResult,
    csatCurrentResult, csatPrevResult,
  ] = await Promise.all([
    // Resolved today
    db.select({ count: count() }).from(helpdeskCase)
      .where(and(eq(helpdeskCase.status, 'RESOLVED'), gte(helpdeskCase.resolvedAt, todayStart))),

    // Resolved yesterday
    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        inArray(helpdeskCase.status, ['RESOLVED', 'CLOSED']),
        gte(helpdeskCase.resolvedAt, yesterdayStart),
        lt(helpdeskCase.resolvedAt, todayStart)
      )),

    // SLA breached today (cases created today with breach flag)
    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        eq(helpdeskCase.slaFirstResponseBreached, true),
        gte(helpdeskCase.createdAt, todayStart)
      )),

    // SLA breached yesterday
    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        eq(helpdeskCase.slaFirstResponseBreached, true),
        gte(helpdeskCase.createdAt, yesterdayStart),
        lt(helpdeskCase.createdAt, todayStart)
      )),

    // Avg response current 30d
    db.select({
      avgMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${helpdeskCase.firstResponseAt} - ${helpdeskCase.createdAt})) / 60)`.as('avg'),
    }).from(helpdeskCase)
      .where(and(isNotNull(helpdeskCase.firstResponseAt), gte(helpdeskCase.createdAt, thirtyDaysAgo))),

    // Avg response prev 30-60d
    db.select({
      avgMinutes: sql<number | null>`AVG(EXTRACT(EPOCH FROM (${helpdeskCase.firstResponseAt} - ${helpdeskCase.createdAt})) / 60)`.as('avg'),
    }).from(helpdeskCase)
      .where(and(
        isNotNull(helpdeskCase.firstResponseAt),
        gte(helpdeskCase.createdAt, sixtyDaysAgo),
        lt(helpdeskCase.createdAt, thirtyDaysAgo)
      )),

    // CSAT current 30d avg
    db.select({
      avgRating: sql<number | null>`AVG(${caseCsat.rating})`.as('avg'),
    }).from(caseCsat)
      .where(and(isNotNull(caseCsat.respondedAt), gte(caseCsat.respondedAt, thirtyDaysAgo))),

    // CSAT prev 30-60d avg
    db.select({
      avgRating: sql<number | null>`AVG(${caseCsat.rating})`.as('avg'),
    }).from(caseCsat)
      .where(and(
        isNotNull(caseCsat.respondedAt),
        gte(caseCsat.respondedAt, sixtyDaysAgo),
        lt(caseCsat.respondedAt, thirtyDaysAgo)
      )),
  ]);

  const resolvedToday = resolvedTodayResult[0]?.count ?? 0;
  const resolvedYesterday = resolvedYesterdayResult[0]?.count ?? 0;
  const breachedToday = breachedTodayResult[0]?.count ?? 0;
  const breachedYesterday = breachedYesterdayResult[0]?.count ?? 0;

  const avgCurrent = avgResponseCurrentResult[0]?.avgMinutes ?? null;
  const avgPrev = avgResponsePrevResult[0]?.avgMinutes ?? null;
  const avgResponseDelta = avgCurrent !== null && avgPrev !== null
    ? Math.round((avgCurrent as number) - (avgPrev as number))
    : null;

  const csatCurrent = csatCurrentResult[0]?.avgRating ?? null;
  const csatPrev = csatPrevResult[0]?.avgRating ?? null;
  const csatDelta = csatCurrent !== null && csatPrev !== null
    ? Math.round(((csatCurrent as number) - (csatPrev as number)) * 10) / 10
    : null;

  return {
    openCasesDelta: null,
    resolvedTodayDelta: resolvedToday - resolvedYesterday,
    avgResponseDelta,
    slaBreachedDelta: breachedToday - breachedYesterday,
    csatDelta,
  };
}
