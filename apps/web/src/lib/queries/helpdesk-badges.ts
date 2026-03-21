import { db } from '@twicely/db';
import { helpdeskCase } from '@twicely/db/schema';
import { count, eq, and, isNull, inArray } from 'drizzle-orm';

const OPEN_STATUSES = ['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED'] as const;

export interface HelpdeskBadges {
  allCases: number;
  myOpen: number;
  unassigned: number;
  emailInbox: number;
  slaBreach: number;
  pending: number;
  escalated: number;
}

/** Get badge counts for the helpdesk sidebar */
export async function getHelpdeskBadges(agentId: string): Promise<HelpdeskBadges> {
  const [
    allResult,
    myOpenResult,
    unassignedResult,
    emailResult,
    slaBreachResult,
    pendingResult,
    escalatedResult,
  ] = await Promise.all([
    db.select({ count: count() }).from(helpdeskCase)
      .where(inArray(helpdeskCase.status, [...OPEN_STATUSES])),

    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        eq(helpdeskCase.assignedAgentId, agentId),
        inArray(helpdeskCase.status, [...OPEN_STATUSES])
      )),

    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        isNull(helpdeskCase.assignedAgentId),
        inArray(helpdeskCase.status, [...OPEN_STATUSES])
      )),

    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        eq(helpdeskCase.channel, 'EMAIL'),
        inArray(helpdeskCase.status, [...OPEN_STATUSES])
      )),

    db.select({ count: count() }).from(helpdeskCase)
      .where(and(
        eq(helpdeskCase.slaFirstResponseBreached, true),
        inArray(helpdeskCase.status, [...OPEN_STATUSES])
      )),

    db.select({ count: count() }).from(helpdeskCase)
      .where(inArray(helpdeskCase.status, ['PENDING_USER', 'PENDING_INTERNAL'])),

    db.select({ count: count() }).from(helpdeskCase)
      .where(eq(helpdeskCase.status, 'ESCALATED')),
  ]);

  return {
    allCases: allResult[0]?.count ?? 0,
    myOpen: myOpenResult[0]?.count ?? 0,
    unassigned: unassignedResult[0]?.count ?? 0,
    emailInbox: emailResult[0]?.count ?? 0,
    slaBreach: slaBreachResult[0]?.count ?? 0,
    pending: pendingResult[0]?.count ?? 0,
    escalated: escalatedResult[0]?.count ?? 0,
  };
}
