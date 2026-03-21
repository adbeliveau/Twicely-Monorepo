import { db } from '@twicely/db';
import { helpdeskCase, caseMessage, caseEvent, caseWatcher, staffUser } from '@twicely/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export type CaseStatus = 'NEW' | 'OPEN' | 'PENDING_USER' | 'PENDING_INTERNAL' | 'ON_HOLD' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
export type CasePriority = 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL' | 'SYSTEM';

export interface CaseListItem {
  id: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  type: string;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface CaseDetail {
  id: string;
  caseNumber: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  channel: string;
  requesterId: string;
  assignedAgentId: string | null;
  assignedTeamId: string | null;
  tags: string[];
  orderId: string | null;
  listingId: string | null;
  sellerId: string | null;
  payoutId: string | null;
  disputeCaseId: string | null;
  returnRequestId: string | null;
  conversationId: string | null;
  slaFirstResponseDueAt: Date | null;
  slaResolutionDueAt: Date | null;
  slaFirstResponseBreached: boolean;
  slaResolutionBreached: boolean;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  messages: CaseMessageItem[];
  events: CaseEventItem[];
}

export interface CaseMessageItem {
  id: string;
  senderType: string;
  senderId: string | null;
  senderName: string | null;
  direction: string;
  body: string;
  bodyHtml: string | null;
  attachments: unknown;
  deliveryStatus: string;
  createdAt: Date;
}

export interface CaseEventItem {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  dataJson: unknown;
  createdAt: Date;
}

const USER_VISIBLE_EVENT_TYPES = [
  'created', 'user_replied', 'status_changed', 'reopened', 'csat_submitted',
];

/** Get paginated list of cases for a user */
export async function getCasesByRequester(
  userId: string,
  filters?: { status?: CaseStatus[] }
): Promise<CaseListItem[]> {
  const conditions = [eq(helpdeskCase.requesterId, userId)];

  if (filters?.status && filters.status.length > 0) {
    conditions.push(
      inArray(helpdeskCase.status, filters.status)
    );
  }

  return db
    .select({
      id: helpdeskCase.id,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      status: helpdeskCase.status,
      priority: helpdeskCase.priority,
      type: helpdeskCase.type,
      updatedAt: helpdeskCase.updatedAt,
      lastActivityAt: helpdeskCase.lastActivityAt,
    })
    .from(helpdeskCase)
    .where(and(...conditions))
    .orderBy(desc(helpdeskCase.lastActivityAt))
    .limit(50);
}

/** Get full case detail for a user — hides internal notes */
export async function getCaseDetail(
  caseId: string,
  userId: string
): Promise<CaseDetail | null> {
  const cases = await db
    .select()
    .from(helpdeskCase)
    .where(and(eq(helpdeskCase.id, caseId), eq(helpdeskCase.requesterId, userId)))
    .limit(1);

  const caseRecord = cases[0];
  if (!caseRecord) return null;

  const userVisibleDirections: readonly MessageDirection[] = ['INBOUND', 'OUTBOUND', 'SYSTEM'];

  const [messages, events] = await Promise.all([
    db
      .select()
      .from(caseMessage)
      .where(and(
        eq(caseMessage.caseId, caseId),
        inArray(caseMessage.direction, userVisibleDirections)
      ))
      .orderBy(desc(caseMessage.createdAt)),
    db
      .select()
      .from(caseEvent)
      .where(and(
        eq(caseEvent.caseId, caseId),
        inArray(caseEvent.eventType, USER_VISIBLE_EVENT_TYPES as [string, ...string[]])
      ))
      .orderBy(desc(caseEvent.createdAt)),
  ]);

  return {
    ...caseRecord,
    messages,
    events,
  };
}

/** Get full case detail for agents — includes internal notes */
export async function getAgentCaseDetail(caseId: string): Promise<CaseDetail | null> {
  const cases = await db
    .select()
    .from(helpdeskCase)
    .where(eq(helpdeskCase.id, caseId))
    .limit(1);

  const caseRecord = cases[0];
  if (!caseRecord) return null;

  const [messages, events] = await Promise.all([
    db
      .select()
      .from(caseMessage)
      .where(eq(caseMessage.caseId, caseId))
      .orderBy(desc(caseMessage.createdAt)),
    db
      .select()
      .from(caseEvent)
      .where(eq(caseEvent.caseId, caseId))
      .orderBy(desc(caseEvent.createdAt)),
  ]);

  return {
    ...caseRecord,
    messages,
    events,
  };
}

/** Get case queue for agent workspace */
export async function getAgentCaseQueue(
  filters?: {
    status?: CaseStatus[];
    priority?: CasePriority[];
    assignedAgentId?: string;
    assignedTeamId?: string;
  }
): Promise<CaseListItem[]> {
  const conditions = [];

  if (filters?.status && filters.status.length > 0) {
    conditions.push(inArray(helpdeskCase.status, filters.status));
  }

  if (filters?.priority && filters.priority.length > 0) {
    conditions.push(inArray(helpdeskCase.priority, filters.priority));
  }

  if (filters?.assignedAgentId) {
    conditions.push(eq(helpdeskCase.assignedAgentId, filters.assignedAgentId));
  }

  if (filters?.assignedTeamId) {
    conditions.push(eq(helpdeskCase.assignedTeamId, filters.assignedTeamId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: helpdeskCase.id,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      status: helpdeskCase.status,
      priority: helpdeskCase.priority,
      type: helpdeskCase.type,
      updatedAt: helpdeskCase.updatedAt,
      lastActivityAt: helpdeskCase.lastActivityAt,
    })
    .from(helpdeskCase)
    .where(where)
    .orderBy(desc(helpdeskCase.lastActivityAt))
    .limit(100);
}

export interface ResolvedCaseItem {
  id: string;
  caseNumber: string;
  subject: string;
  type: string;
  priority: string;
  requesterEmail: string | null;
  assignedAgentId: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
}

/** Get RESOLVED or CLOSED cases for the archive page */
export async function getResolvedCases(
  tab: 'resolved' | 'closed',
  limit = 100
): Promise<ResolvedCaseItem[]> {
  const statusValue = tab === 'resolved' ? 'RESOLVED' : 'CLOSED';
  const orderCol = tab === 'resolved' ? helpdeskCase.resolvedAt : helpdeskCase.closedAt;

  return db
    .select({
      id: helpdeskCase.id,
      caseNumber: helpdeskCase.caseNumber,
      subject: helpdeskCase.subject,
      type: helpdeskCase.type,
      priority: helpdeskCase.priority,
      requesterEmail: helpdeskCase.requesterEmail,
      assignedAgentId: helpdeskCase.assignedAgentId,
      resolvedAt: helpdeskCase.resolvedAt,
      closedAt: helpdeskCase.closedAt,
      createdAt: helpdeskCase.createdAt,
    })
    .from(helpdeskCase)
    .where(eq(helpdeskCase.status, statusValue))
    .orderBy(desc(orderCol))
    .limit(limit);
}

export interface CaseWatcherItem {
  id: string;
  staffUserId: string;
  displayName: string;
  createdAt: Date;
}

/** Get all watchers for a case, joined with staff display names */
export async function getCaseWatchers(caseId: string): Promise<CaseWatcherItem[]> {
  const rows = await db
    .select({
      id: caseWatcher.id,
      staffUserId: caseWatcher.staffUserId,
      displayName: staffUser.displayName,
      createdAt: caseWatcher.createdAt,
    })
    .from(caseWatcher)
    .innerJoin(staffUser, eq(caseWatcher.staffUserId, staffUser.id))
    .where(eq(caseWatcher.caseId, caseId));

  return rows;
}
