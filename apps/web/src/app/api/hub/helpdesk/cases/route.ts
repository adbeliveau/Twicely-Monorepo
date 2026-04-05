import { NextRequest, NextResponse } from 'next/server';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { helpdeskCase, helpdeskTeam, caseMessage } from '@twicely/db/schema';
import { eq, and, desc, ilike, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { escapeLike } from '@/lib/utils/escape-like';

type CaseStatus = typeof helpdeskCase.status.enumValues[number];
type CasePriority = typeof helpdeskCase.priority.enumValues[number];
type CaseChannel = typeof helpdeskCase.channel.enumValues[number];

const VALID_STATUSES = new Set<string>(['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED']);
const VALID_PRIORITIES = new Set<string>(['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']);
const VALID_CHANNELS = new Set<string>(['WEB', 'EMAIL', 'SYSTEM', 'INTERNAL']);

export async function GET(request: NextRequest): Promise<NextResponse> {
  let ability;
  let session;
  try {
    const result = await staffAuthorize();
    ability = result.ability;
    session = result.session;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ability.can('read', 'HelpdeskCase')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get('status');
  const priority = params.get('priority');
  const channel = params.get('channel');
  const assignee = params.get('assignee');
  const search = params.get('search');

  const conditions: SQL[] = [];

  if (status && VALID_STATUSES.has(status)) {
    conditions.push(eq(helpdeskCase.status, status as CaseStatus));
  }
  if (priority && VALID_PRIORITIES.has(priority)) {
    conditions.push(eq(helpdeskCase.priority, priority as CasePriority));
  }
  if (channel && VALID_CHANNELS.has(channel)) {
    conditions.push(eq(helpdeskCase.channel, channel as CaseChannel));
  }
  if (assignee === 'me') {
    conditions.push(eq(helpdeskCase.assignedAgentId, session.staffUserId));
  } else if (assignee === 'unassigned') {
    conditions.push(isNull(helpdeskCase.assignedAgentId));
  }
  if (search) {
    const sanitized = escapeLike(search.slice(0, 200));
    conditions.push(
      sql`(${ilike(helpdeskCase.caseNumber, `%${sanitized}%`)} OR ${ilike(helpdeskCase.subject, `%${sanitized}%`)})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const cases = await db
    .select({
      id: helpdeskCase.id,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      status: helpdeskCase.status,
      priority: helpdeskCase.priority,
      type: helpdeskCase.type,
      channel: helpdeskCase.channel,
      requesterId: helpdeskCase.requesterId,
      requesterEmail: helpdeskCase.requesterEmail,
      assignedAgentId: helpdeskCase.assignedAgentId,
      assignedTeamId: helpdeskCase.assignedTeamId,
      slaFirstResponseDue: helpdeskCase.slaFirstResponseDueAt,
      firstResponseAt: helpdeskCase.firstResponseAt,
      createdAt: helpdeskCase.createdAt,
      lastActivityAt: helpdeskCase.lastActivityAt,
    })
    .from(helpdeskCase)
    .where(where)
    .orderBy(desc(helpdeskCase.lastActivityAt))
    .limit(100);

  // Batch-load team names
  const teamIds = [...new Set(cases.map((c) => c.assignedTeamId).filter(Boolean))] as string[];
  const teamsMap = new Map<string, string>();
  if (teamIds.length > 0) {
    const teams = await db
      .select({ id: helpdeskTeam.id, name: helpdeskTeam.name })
      .from(helpdeskTeam)
      .where(inArray(helpdeskTeam.id, teamIds));
    for (const t of teams) {
      teamsMap.set(t.id, t.name);
    }
  }

  // Batch-load last message direction per case for hasUnread heuristic.
  // hasUnread = true when most recent message is INBOUND (unanswered customer message).
  // Skipped for RESOLVED/CLOSED cases (never unread).
  const openCaseIds = cases
    .filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED')
    .map((c) => c.id);
  const unreadSet = new Set<string>();
  if (openCaseIds.length > 0) {
    const lastMessages = await db
      .select({
        caseId: caseMessage.caseId,
        direction: caseMessage.direction,
      })
      .from(caseMessage)
      .where(
        sql`${caseMessage.caseId} IN (${sql.join(openCaseIds.map((id) => sql`${id}`), sql`, `)})
          AND ${caseMessage.createdAt} = (
            SELECT MAX(cm2.created_at) FROM case_message cm2
            WHERE cm2.case_id = ${caseMessage.caseId}
          )`
      );
    for (const row of lastMessages) {
      if (row.direction === 'INBOUND') {
        unreadSet.add(row.caseId);
      }
    }
  }

  const mapped = cases.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    subject: c.subject,
    status: c.status,
    priority: c.priority,
    type: c.type,
    channel: c.channel,
    requesterId: c.requesterId,
    requesterEmail: c.requesterEmail,
    assignedAgentId: c.assignedAgentId,
    assignedTeam: c.assignedTeamId
      ? { id: c.assignedTeamId, displayName: teamsMap.get(c.assignedTeamId) ?? 'Unknown' }
      : null,
    slaFirstResponseDue: c.slaFirstResponseDue?.toISOString() ?? null,
    firstResponseAt: c.firstResponseAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    lastActivityAt: c.lastActivityAt.toISOString(),
    hasUnread: unreadSet.has(c.id),
  }));

  return NextResponse.json({ cases: mapped, total: mapped.length });
}
