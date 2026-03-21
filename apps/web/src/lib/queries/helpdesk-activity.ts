import { db } from '@twicely/db';
import { helpdeskCase, caseEvent, staffUser, user } from '@twicely/db/schema';
import { sql, eq, and } from 'drizzle-orm';

export interface RecentActivity {
  type: string;
  agent: string;
  caseNumber: string;
  description: string;
  timeAgo: string;
}

/** Get recent helpdesk activity with resolved agent/user names and case numbers */
export async function getHelpdeskRecentActivity(): Promise<RecentActivity[]> {
  const events = await db
    .select({
      eventType: caseEvent.eventType,
      actorId: caseEvent.actorId,
      actorType: caseEvent.actorType,
      caseId: caseEvent.caseId,
      dataJson: caseEvent.dataJson,
      createdAt: caseEvent.createdAt,
      caseNumber: helpdeskCase.caseNumber,
      staffName: staffUser.displayName,
      userName: user.name,
    })
    .from(caseEvent)
    .innerJoin(helpdeskCase, eq(caseEvent.caseId, helpdeskCase.id))
    .leftJoin(staffUser, and(
      eq(caseEvent.actorId, staffUser.id),
      sql`${caseEvent.actorType} = 'agent'`
    ))
    .leftJoin(user, and(
      eq(caseEvent.actorId, user.id),
      sql`${caseEvent.actorType} = 'user'`
    ))
    .orderBy(sql`${caseEvent.createdAt} DESC`)
    .limit(10);

  const now = Date.now();
  return events.map((e) => {
    const diffMs = now - e.createdAt.getTime();
    const mins = Math.floor(diffMs / 60000);
    let timeAgo: string;
    if (mins < 60) timeAgo = `${mins} min ago`;
    else if (mins < 1440) timeAgo = `${Math.floor(mins / 60)} hr ago`;
    else timeAgo = `${Math.floor(mins / 1440)}d ago`;

    const eventMap: Record<string, string> = {
      status_changed: 'resolved', agent_assigned: 'assigned',
      created: 'created', escalated: 'escalated',
    };

    let agentName = 'System';
    if (e.actorType === 'agent' && e.staffName) {
      agentName = e.staffName;
    } else if (e.actorType === 'user' && e.userName) {
      agentName = e.userName;
    } else if (e.actorType !== 'system' && e.actorId) {
      agentName = e.actorId;
    }

    return {
      type: eventMap[e.eventType] ?? 'activity',
      agent: agentName,
      caseNumber: e.caseNumber,
      description: '',
      timeAgo,
    };
  });
}
