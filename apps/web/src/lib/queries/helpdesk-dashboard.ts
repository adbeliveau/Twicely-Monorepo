import { db } from '@twicely/db';
import { helpdeskCase, caseCsat, staffUser, helpdeskTeam, helpdeskTeamMember } from '@twicely/db/schema';
import { sql, eq, and, gte, not, inArray, count, isNotNull, lt } from 'drizzle-orm';
import type { TeamStatusItem } from '@/components/helpdesk/team-status-grid';

const OPEN_STATUSES = ['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED'] as const;

export interface DashboardStats {
  openCases: number;
  resolvedToday: number;
  avgResponseMinutes: number;
  slaBreached: number;
  csatScore: number | null;
  csatCount: number;
  avgResolutionMinutes: number;
  slaCompliancePct: number;
  slaFirstResponsePct: number;
  slaResolutionPct: number;
}

/** Get aggregate stats for the helpdesk dashboard */
export async function getHelpdeskDashboardStats(): Promise<DashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    openResult, resolvedResult, breachedResult, avgResponseResult,
    csatResult, avgResolutionResult, slaComplianceResult,
    slaFirstResponseResult, slaResolutionResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(helpdeskCase)
      .where(inArray(helpdeskCase.status, [...OPEN_STATUSES])),

    db.select({ count: count() }).from(helpdeskCase)
      .where(and(eq(helpdeskCase.status, 'RESOLVED'), gte(helpdeskCase.resolvedAt, todayStart))),

    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        inArray(helpdeskCase.status, [...OPEN_STATUSES]),
        eq(helpdeskCase.slaFirstResponseBreached, true)
      )),

    db.select({
      avgMinutes: sql<number>`COALESCE(EXTRACT(EPOCH FROM AVG(${helpdeskCase.firstResponseAt} - ${helpdeskCase.createdAt})) / 60, 0)`.as('avg'),
    }).from(helpdeskCase).where(not(sql`${helpdeskCase.firstResponseAt} IS NULL`)),

    db.select({
      avgRating: sql<number | null>`AVG(${caseCsat.rating})`.as('avg_rating'),
      responseCount: count(),
    }).from(caseCsat)
      .where(and(isNotNull(caseCsat.respondedAt), gte(caseCsat.respondedAt, thirtyDaysAgo))),

    db.select({
      avgMinutes: sql<number>`COALESCE(EXTRACT(EPOCH FROM AVG(${helpdeskCase.resolvedAt} - ${helpdeskCase.createdAt})) / 60, 0)`.as('avg'),
    }).from(helpdeskCase)
      .where(and(isNotNull(helpdeskCase.resolvedAt), gte(helpdeskCase.resolvedAt, thirtyDaysAgo))),

    db.select({
      compliant: sql<number>`COUNT(*) FILTER (WHERE NOT ${helpdeskCase.slaFirstResponseBreached} AND NOT ${helpdeskCase.slaResolutionBreached})`.as('compliant'),
      total: count(),
    }).from(helpdeskCase)
      .where(and(
        isNotNull(helpdeskCase.resolvedAt),
        gte(helpdeskCase.resolvedAt, thirtyDaysAgo),
        isNotNull(helpdeskCase.slaFirstResponseDueAt)
      )),

    db.select({
      compliant: sql<number>`COUNT(*) FILTER (WHERE NOT ${helpdeskCase.slaFirstResponseBreached} AND ${helpdeskCase.firstResponseAt} IS NOT NULL)`.as('compliant'),
      total: sql<number>`COUNT(*) FILTER (WHERE ${helpdeskCase.firstResponseAt} IS NOT NULL)`.as('total'),
    }).from(helpdeskCase)
      .where(and(gte(helpdeskCase.createdAt, thirtyDaysAgo), isNotNull(helpdeskCase.slaFirstResponseDueAt))),

    db.select({
      compliant: sql<number>`COUNT(*) FILTER (WHERE NOT ${helpdeskCase.slaResolutionBreached})`.as('compliant'),
      total: count(),
    }).from(helpdeskCase)
      .where(and(
        isNotNull(helpdeskCase.resolvedAt),
        gte(helpdeskCase.resolvedAt, thirtyDaysAgo),
        isNotNull(helpdeskCase.slaFirstResponseDueAt)
      )),
  ]);

  const csatRow = csatResult[0];
  const csatScore = csatRow && csatRow.responseCount > 0 ? (csatRow.avgRating ?? null) : null;
  const csatCount = csatRow?.responseCount ?? 0;
  const slaRow = slaComplianceResult[0];
  const slaCompliancePct = slaRow && slaRow.total > 0 ? Math.round((slaRow.compliant / slaRow.total) * 100) : 100;
  const slaFRRow = slaFirstResponseResult[0];
  const slaFirstResponsePct = slaFRRow && slaFRRow.total > 0 ? Math.round((slaFRRow.compliant / slaFRRow.total) * 100) : 100;
  const slaResRow = slaResolutionResult[0];
  const slaResolutionPct = slaResRow && slaResRow.total > 0 ? Math.round((slaResRow.compliant / slaResRow.total) * 100) : 100;

  return {
    openCases: openResult[0]?.count ?? 0,
    resolvedToday: resolvedResult[0]?.count ?? 0,
    avgResponseMinutes: Math.round(avgResponseResult[0]?.avgMinutes ?? 0),
    slaBreached: breachedResult[0]?.count ?? 0,
    csatScore: csatScore !== null ? Math.round((csatScore as number) * 10) / 10 : null,
    csatCount,
    avgResolutionMinutes: Math.round(avgResolutionResult[0]?.avgMinutes ?? 0),
    slaCompliancePct,
    slaFirstResponsePct,
    slaResolutionPct,
  };
}

export interface DashboardVolumeDay {
  date: string;
  email: number;
  web: number;
  system: number;
}

/** Get case volume by channel for last 7 days */
export async function getHelpdeskCaseVolume(): Promise<DashboardVolumeDay[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(${helpdeskCase.createdAt}, 'Dy')`.as('day'),
      channel: helpdeskCase.channel,
      count: count(),
    })
    .from(helpdeskCase)
    .where(gte(helpdeskCase.createdAt, sevenDaysAgo))
    .groupBy(sql`TO_CHAR(${helpdeskCase.createdAt}, 'Dy')`, helpdeskCase.channel);

  const dayMap = new Map<string, DashboardVolumeDay>();
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (const name of dayNames) {
    dayMap.set(name, { date: name, email: 0, web: 0, system: 0 });
  }

  for (const row of rows) {
    const entry = dayMap.get(row.day);
    if (!entry) continue;
    if (row.channel === 'EMAIL') entry.email = row.count;
    else if (row.channel === 'WEB') entry.web = row.count;
    else entry.system += row.count;
  }

  return dayNames.map((d) => dayMap.get(d)!);
}

export interface TeamWorkloadItem {
  name: string;
  initials: string;
  current: number;
  max: number;
}

/** Get case count per staff agent for team workload widget */
export async function getTeamWorkload(): Promise<TeamWorkloadItem[]> {
  const rows = await db
    .select({
      agentId: helpdeskCase.assignedAgentId,
      displayName: staffUser.displayName,
      caseCount: count(),
    })
    .from(helpdeskCase)
    .innerJoin(staffUser, eq(helpdeskCase.assignedAgentId, staffUser.id))
    .where(inArray(helpdeskCase.status, [...OPEN_STATUSES]))
    .groupBy(helpdeskCase.assignedAgentId, staffUser.displayName);

  return rows.map((r) => {
    const parts = r.displayName.split(' ');
    const initials = parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2);
    return { name: r.displayName, initials, current: r.caseCount, max: 25 };
  });
}

// =============================================================================
// TEAM STATUS GRID
// =============================================================================

/** Get online/away/offline counts per team.
 * Online = isAvailable true + assigned a case in last 30 minutes (proxy for active).
 * Away   = isAvailable true + no recent assignment.
 * Offline = isAvailable false.
 */
export async function getTeamStatusGrid(): Promise<TeamStatusItem[]> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);

  const teams = await db
    .select({ id: helpdeskTeam.id, name: helpdeskTeam.name })
    .from(helpdeskTeam)
    .orderBy(helpdeskTeam.name);

  if (teams.length === 0) return [];

  const members = await db
    .select({
      teamId: helpdeskTeamMember.teamId,
      isAvailable: helpdeskTeamMember.isAvailable,
      staffUserId: helpdeskTeamMember.staffUserId,
    })
    .from(helpdeskTeamMember)
    .where(inArray(helpdeskTeamMember.teamId, teams.map((t) => t.id)));

  // Find staff who have had a case assigned in last 30 minutes
  const recentlyActiveStaffIds = new Set<string>();
  if (members.length > 0) {
    const staffIds = [...new Set(members.map((m) => m.staffUserId))];
    const recentCases = await db
      .select({ agentId: helpdeskCase.assignedAgentId })
      .from(helpdeskCase)
      .where(and(
        inArray(helpdeskCase.status, [...OPEN_STATUSES]),
        gte(helpdeskCase.lastActivityAt, thirtyMinutesAgo),
        inArray(helpdeskCase.assignedAgentId, staffIds)
      ));
    for (const c of recentCases) {
      if (c.agentId) recentlyActiveStaffIds.add(c.agentId);
    }
  }

  return teams.map((team) => {
    const teamMembers = members.filter((m) => m.teamId === team.id);
    let online = 0;
    let away = 0;
    let offline = 0;
    for (const m of teamMembers) {
      if (!m.isAvailable) { offline++; }
      else if (recentlyActiveStaffIds.has(m.staffUserId)) { online++; }
      else { away++; }
    }
    return { teamId: team.id, teamName: team.name, online, away, offline, total: teamMembers.length };
  });
}

// =============================================================================
// STAT TRENDS (7-day)
// =============================================================================

export interface StatTrends {
  openCasesTrend: number[];
  resolvedTrend: number[];
  avgResponseTrend: number[];
  slaBreachedTrend: number[];
  csatTrend: number[];
}

/** Get 7-day trend data for each stat card metric */
export async function getStatTrends(): Promise<StatTrends> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const results = await Promise.all(
    days.map(async (dayStart) => {
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const [openRow, resolvedRow, breachedRow, avgRow, csatRow] = await Promise.all([
        db.select({ count: count() }).from(helpdeskCase)
          .where(and(lt(helpdeskCase.createdAt, dayEnd), gte(helpdeskCase.lastActivityAt, dayStart), inArray(helpdeskCase.status, [...OPEN_STATUSES]))),
        db.select({ count: count() }).from(helpdeskCase)
          .where(and(gte(helpdeskCase.resolvedAt, dayStart), lt(helpdeskCase.resolvedAt, dayEnd))),
        db.select({ count: count() }).from(helpdeskCase)
          .where(and(gte(helpdeskCase.createdAt, dayStart), lt(helpdeskCase.createdAt, dayEnd), eq(helpdeskCase.slaFirstResponseBreached, true))),
        db.select({ avg: sql<number>`COALESCE(EXTRACT(EPOCH FROM AVG(${helpdeskCase.firstResponseAt} - ${helpdeskCase.createdAt})) / 60, 0)` }).from(helpdeskCase)
          .where(and(gte(helpdeskCase.firstResponseAt, dayStart), lt(helpdeskCase.firstResponseAt, dayEnd))),
        db.select({ avg: sql<number | null>`AVG(${caseCsat.rating})` }).from(caseCsat)
          .where(and(isNotNull(caseCsat.respondedAt), gte(caseCsat.respondedAt, dayStart), lt(caseCsat.respondedAt, dayEnd))),
      ]);
      return {
        open: openRow[0]?.count ?? 0,
        resolved: resolvedRow[0]?.count ?? 0,
        breached: breachedRow[0]?.count ?? 0,
        avgResponse: Math.round(avgRow[0]?.avg ?? 0),
        csat: Math.round(((csatRow[0]?.avg as number | null) ?? 0) * 10) / 10,
      };
    })
  );

  return {
    openCasesTrend:    results.map((r) => r.open),
    resolvedTrend:     results.map((r) => r.resolved),
    avgResponseTrend:  results.map((r) => r.avgResponse),
    slaBreachedTrend:  results.map((r) => r.breached),
    csatTrend:         results.map((r) => r.csat),
  };
}
