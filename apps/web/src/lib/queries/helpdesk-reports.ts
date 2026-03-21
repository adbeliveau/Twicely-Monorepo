import { db } from '@twicely/db';
import { helpdeskCase, caseCsat, staffUser } from '@twicely/db/schema';
import { sql, eq, and, gte, lte, isNotNull, count, inArray } from 'drizzle-orm';

interface DateRange {
  from: Date;
  to: Date;
}

export interface ReportMetrics {
  openCases: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  slaCompliancePct: number;
  csatScore: number | null;
  resolvedCount: number;
}

/** Get 6 top-level report metrics for the given date range */
export async function getHelpdeskReportMetrics(dateRange: DateRange): Promise<ReportMetrics> {
  const { from, to } = dateRange;

  const [
    openResult, avgFirstResponseResult, avgResolutionResult,
    slaResult, csatResult, resolvedResult,
  ] = await Promise.all([
    // Current open cases (ignores date range)
    db.select({ count: count() }).from(helpdeskCase)
      .where(
        inArray(helpdeskCase.status, ['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED'])
      ),

    // Avg first response time for cases in range
    db.select({
      avgMinutes: sql<number>`
        COALESCE(
          EXTRACT(EPOCH FROM AVG(${helpdeskCase.firstResponseAt} - ${helpdeskCase.createdAt})) / 60,
          0
        )
      `.as('avg_first_response'),
    }).from(helpdeskCase)
      .where(
        and(
          isNotNull(helpdeskCase.firstResponseAt),
          gte(helpdeskCase.createdAt, from),
          lte(helpdeskCase.createdAt, to)
        )
      ),

    // Avg resolution time for cases resolved in range
    db.select({
      avgMinutes: sql<number>`
        COALESCE(
          EXTRACT(EPOCH FROM AVG(${helpdeskCase.resolvedAt} - ${helpdeskCase.createdAt})) / 60,
          0
        )
      `.as('avg_resolution'),
    }).from(helpdeskCase)
      .where(
        and(
          isNotNull(helpdeskCase.resolvedAt),
          gte(helpdeskCase.resolvedAt, from),
          lte(helpdeskCase.resolvedAt, to)
        )
      ),

    // SLA compliance for cases in range
    db.select({
      compliant: sql<number>`
        COUNT(*) FILTER (
          WHERE NOT ${helpdeskCase.slaFirstResponseBreached}
          AND NOT ${helpdeskCase.slaResolutionBreached}
        )
      `.as('compliant'),
      total: count(),
    }).from(helpdeskCase)
      .where(
        and(
          gte(helpdeskCase.createdAt, from),
          lte(helpdeskCase.createdAt, to),
          isNotNull(helpdeskCase.slaFirstResponseDueAt)
        )
      ),

    // CSAT for cases resolved in range
    db.select({
      avgRating: sql<number | null>`AVG(${caseCsat.rating})`.as('avg_rating'),
    }).from(caseCsat)
      .innerJoin(helpdeskCase, eq(caseCsat.caseId, helpdeskCase.id))
      .where(
        and(
          isNotNull(caseCsat.respondedAt),
          isNotNull(helpdeskCase.resolvedAt),
          gte(helpdeskCase.resolvedAt, from),
          lte(helpdeskCase.resolvedAt, to)
        )
      ),

    // Resolved count in range
    db.select({ count: count() }).from(helpdeskCase)
      .where(
        and(
          isNotNull(helpdeskCase.resolvedAt),
          gte(helpdeskCase.resolvedAt, from),
          lte(helpdeskCase.resolvedAt, to)
        )
      ),
  ]);

  const slaRow = slaResult[0];
  const slaCompliancePct = slaRow && slaRow.total > 0
    ? Math.round((slaRow.compliant / slaRow.total) * 100)
    : 100;

  const rawCsat = csatResult[0]?.avgRating ?? null;
  const csatScore = rawCsat !== null
    ? Math.round((rawCsat as number) * 10) / 10
    : null;

  return {
    openCases: openResult[0]?.count ?? 0,
    avgFirstResponseMinutes: Math.round(avgFirstResponseResult[0]?.avgMinutes ?? 0),
    avgResolutionMinutes: Math.round(avgResolutionResult[0]?.avgMinutes ?? 0),
    slaCompliancePct,
    csatScore,
    resolvedCount: resolvedResult[0]?.count ?? 0,
  };
}

export interface VolumeDay {
  date: string;
  created: number;
  resolved: number;
}

/** Get daily created/resolved case counts for date range */
export async function getHelpdeskVolumeTimeseries(dateRange: DateRange): Promise<VolumeDay[]> {
  const { from, to } = dateRange;

  const [createdRows, resolvedRows] = await Promise.all([
    db.select({
      date: sql<string>`TO_CHAR(${helpdeskCase.createdAt}, 'YYYY-MM-DD')`.as('date'),
      count: count(),
    }).from(helpdeskCase)
      .where(and(gte(helpdeskCase.createdAt, from), lte(helpdeskCase.createdAt, to)))
      .groupBy(sql`TO_CHAR(${helpdeskCase.createdAt}, 'YYYY-MM-DD')`),

    db.select({
      date: sql<string>`TO_CHAR(${helpdeskCase.resolvedAt}, 'YYYY-MM-DD')`.as('date'),
      count: count(),
    }).from(helpdeskCase)
      .where(
        and(
          isNotNull(helpdeskCase.resolvedAt),
          gte(helpdeskCase.resolvedAt, from),
          lte(helpdeskCase.resolvedAt, to)
        )
      )
      .groupBy(sql`TO_CHAR(${helpdeskCase.resolvedAt}, 'YYYY-MM-DD')`),
  ]);

  // Build a map of all days in range, filling zeros
  const dayMap = new Map<string, VolumeDay>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const dateStr = cursor.toISOString().slice(0, 10);
    dayMap.set(dateStr, { date: dateStr, created: 0, resolved: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const row of createdRows) {
    const entry = dayMap.get(row.date);
    if (entry) entry.created = row.count;
  }
  for (const row of resolvedRows) {
    const entry = dayMap.get(row.date);
    if (entry) entry.resolved = row.count;
  }

  return Array.from(dayMap.values());
}

export interface TypeCount {
  type: string;
  count: number;
}

/** Get case counts grouped by type for date range */
export async function getHelpdeskCasesByType(dateRange: DateRange): Promise<TypeCount[]> {
  const { from, to } = dateRange;
  const rows = await db
    .select({ type: helpdeskCase.type, count: count() })
    .from(helpdeskCase)
    .where(and(gte(helpdeskCase.createdAt, from), lte(helpdeskCase.createdAt, to)))
    .groupBy(helpdeskCase.type);

  return rows.map((r) => ({ type: r.type, count: r.count }));
}

export interface ChannelCount {
  channel: string;
  count: number;
}

/** Get case counts grouped by channel for date range */
export async function getHelpdeskCasesByChannel(dateRange: DateRange): Promise<ChannelCount[]> {
  const { from, to } = dateRange;
  const rows = await db
    .select({ channel: helpdeskCase.channel, count: count() })
    .from(helpdeskCase)
    .where(and(gte(helpdeskCase.createdAt, from), lte(helpdeskCase.createdAt, to)))
    .groupBy(helpdeskCase.channel);

  return rows.map((r) => ({ channel: r.channel, count: r.count }));
}

export interface AgentPerformanceRow {
  agentId: string;
  agentName: string;
  casesHandled: number;
  avgResponseMinutes: number;
  avgResolutionMinutes: number;
  csatScore: number | null;
}

/** Get per-agent performance metrics for date range */
export async function getHelpdeskAgentPerformance(dateRange: DateRange): Promise<AgentPerformanceRow[]> {
  const { from, to } = dateRange;

  const agentRows = await db
    .select({
      agentId: helpdeskCase.assignedAgentId,
      agentName: staffUser.displayName,
      casesHandled: count(),
      avgResponseMinutes: sql<number>`
        COALESCE(
          EXTRACT(EPOCH FROM AVG(${helpdeskCase.firstResponseAt} - ${helpdeskCase.createdAt})) / 60,
          0
        )
      `.as('avg_response'),
      avgResolutionMinutes: sql<number>`
        COALESCE(
          EXTRACT(EPOCH FROM AVG(
            CASE WHEN ${helpdeskCase.resolvedAt} IS NOT NULL
              THEN ${helpdeskCase.resolvedAt} - ${helpdeskCase.createdAt}
            END
          )) / 60,
          0
        )
      `.as('avg_resolution'),
    })
    .from(helpdeskCase)
    .innerJoin(staffUser, eq(helpdeskCase.assignedAgentId, staffUser.id))
    .where(and(gte(helpdeskCase.createdAt, from), lte(helpdeskCase.createdAt, to)))
    .groupBy(helpdeskCase.assignedAgentId, staffUser.displayName);

  if (agentRows.length === 0) return [];

  const agentIds = agentRows.map((r) => r.agentId).filter((id): id is string => id !== null);

  const csatRows = agentIds.length > 0
    ? await db
        .select({
          agentId: helpdeskCase.assignedAgentId,
          avgRating: sql<number | null>`AVG(${caseCsat.rating})`.as('avg_rating'),
        })
        .from(caseCsat)
        .innerJoin(helpdeskCase, eq(caseCsat.caseId, helpdeskCase.id))
        .where(
          and(
            isNotNull(caseCsat.respondedAt),
            isNotNull(helpdeskCase.assignedAgentId),
            inArray(helpdeskCase.assignedAgentId, agentIds),
            gte(helpdeskCase.createdAt, from),
            lte(helpdeskCase.createdAt, to)
          )
        )
        .groupBy(helpdeskCase.assignedAgentId)
    : [];

  const csatMap = new Map<string, number>();
  for (const c of csatRows) {
    if (c.agentId && c.avgRating !== null) {
      csatMap.set(c.agentId, Math.round((c.avgRating as number) * 10) / 10);
    }
  }

  return agentRows
    .filter((r) => r.agentId !== null)
    .map((r) => ({
      agentId: r.agentId!,
      agentName: r.agentName,
      casesHandled: r.casesHandled,
      avgResponseMinutes: Math.round(r.avgResponseMinutes),
      avgResolutionMinutes: Math.round(r.avgResolutionMinutes),
      csatScore: csatMap.get(r.agentId!) ?? null,
    }));
}
