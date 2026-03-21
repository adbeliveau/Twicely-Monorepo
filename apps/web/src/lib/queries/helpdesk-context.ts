import { db } from '@twicely/db';
import {
  helpdeskCase, user, order, staffUser, helpdeskTeam,
} from '@twicely/db/schema';
import { eq, and, count, ne } from 'drizzle-orm';
import type { CaseContextData } from '@/components/helpdesk/context-panel';

/**
 * Fetches full context data for the case detail right panel.
 * Runs 5 parallel queries: requester, order, agent, team, previous cases.
 */
export async function getCaseContext(
  caseRecord: {
    requesterId: string;
    orderId: string | null;
    assignedAgentId: string | null;
    assignedTeamId: string | null;
    slaFirstResponseDueAt: Date | null;
    slaResolutionDueAt: Date | null;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    tags: string[] | null;
    id: string;
  }
): Promise<CaseContextData> {
  try {
    const [
      requesterResult,
      orderResult,
      agentResult,
      teamResult,
      previousCasesResult,
      requesterStats,
    ] = await Promise.all([
      // 1. Requester info
      db.select({
        name: user.name,
        email: user.email,
        displayName: user.displayName,
      })
        .from(user)
        .where(eq(user.id, caseRecord.requesterId))
        .limit(1),

      // 2. Linked order (if any)
      caseRecord.orderId
        ? db.select({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalCents: order.totalCents,
          })
            .from(order)
            .where(eq(order.id, caseRecord.orderId))
            .limit(1)
        : Promise.resolve([]),

      // 3. Assigned agent name
      caseRecord.assignedAgentId
        ? db.select({ displayName: staffUser.displayName })
            .from(staffUser)
            .where(eq(staffUser.id, caseRecord.assignedAgentId))
            .limit(1)
        : Promise.resolve([]),

      // 4. Assigned team name
      caseRecord.assignedTeamId
        ? db.select({ name: helpdeskTeam.name })
            .from(helpdeskTeam)
            .where(eq(helpdeskTeam.id, caseRecord.assignedTeamId))
            .limit(1)
        : Promise.resolve([]),

      // 5. Previous cases by same requester (exclude current)
      db.select({
        caseNumber: helpdeskCase.caseNumber,
        subject: helpdeskCase.subject,
        status: helpdeskCase.status,
      })
        .from(helpdeskCase)
        .where(
          and(
            eq(helpdeskCase.requesterId, caseRecord.requesterId),
            ne(helpdeskCase.id, caseRecord.id)
          )
        )
        .orderBy(helpdeskCase.createdAt)
        .limit(5),

      // 6. Requester stats (order count, case count, dispute count)
      getRequesterStats(caseRecord.requesterId),
    ]);

    const requester = requesterResult[0];
    const linkedOrder = orderResult[0];
    const agent = agentResult[0];
    const team = teamResult[0];

    return {
      requesterName: requester?.displayName ?? requester?.name ?? undefined,
      requesterEmail: requester?.email ?? undefined,
      requesterStats: requesterStats ?? undefined,
      order: linkedOrder
        ? {
            id: linkedOrder.id,
            orderNumber: linkedOrder.orderNumber,
            status: linkedOrder.status,
            totalCents: linkedOrder.totalCents,
          }
        : undefined,
      slaFirstResponseDueAt: caseRecord.slaFirstResponseDueAt,
      slaResolutionDueAt: caseRecord.slaResolutionDueAt,
      firstResponseAt: caseRecord.firstResponseAt,
      resolvedAt: caseRecord.resolvedAt,
      tags: caseRecord.tags ?? [],
      assignedAgentId: caseRecord.assignedAgentId,
      assignedAgentName: agent?.displayName ?? undefined,
      assignedTeamName: team?.name ?? undefined,
      previousCases: previousCasesResult,
    };
  } catch {
    return {
      tags: [],
      requesterName: undefined,
      requesterEmail: undefined,
    };
  }
}

async function getRequesterStats(
  requesterId: string
): Promise<{ orderCount: number; caseCount: number; disputeCount: number }> {
  const [orderCount, caseCount] = await Promise.all([
    db.select({ count: count() })
      .from(order)
      .where(eq(order.buyerId, requesterId)),
    db.select({ count: count() })
      .from(helpdeskCase)
      .where(eq(helpdeskCase.requesterId, requesterId)),
  ]);

  return {
    orderCount: orderCount[0]?.count ?? 0,
    caseCount: caseCount[0]?.count ?? 0,
    disputeCount: 0, // dispute count requires separate join; keep as 0 for now
  };
}
