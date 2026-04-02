/**
 * Helpdesk routing engine.
 * Evaluates routing rules against case data to assign team/agent/priority/tags.
 */
import { db } from '@twicely/db';
import { helpdeskRoutingRule, helpdeskTeamMember, helpdeskTeam } from '@twicely/db/schema';
import { eq, and, asc } from 'drizzle-orm';

type CaseType = 'SUPPORT' | 'ORDER' | 'RETURN' | 'DISPUTE' | 'CHARGEBACK' | 'BILLING' | 'ACCOUNT' | 'MODERATION' | 'SYSTEM';
type CasePriority = 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
type CaseChannel = 'WEB' | 'EMAIL' | 'SYSTEM' | 'INTERNAL';

export interface CaseRoutingInput {
  type: CaseType;
  priority: CasePriority;
  channel: CaseChannel;
  subject: string;
  requesterType: string;
  tags?: string[];
}

export interface RoutingResult {
  assignedTeamId: string | null;
  assignedAgentId: string | null;
  priority: CasePriority;
  tags: string[];
  category: string | null;
}

interface RoutingCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface RoutingActions {
  assignTeamId?: string;
  assignAgentId?: string;
  setPriority?: CasePriority;
  addTags?: string[];
  setCategory?: string;
}

function evaluateCondition(condition: RoutingCondition, caseData: CaseRoutingInput): boolean {
  const caseFields: Record<string, unknown> = { ...caseData };
  const fieldValue = caseFields[condition.field];
  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'contains':
      return typeof fieldValue === 'string' && typeof condition.value === 'string' &&
        fieldValue.toLowerCase().includes(condition.value.toLowerCase());
    default:
      return false;
  }
}

/** Round-robin: pick least-loaded available agent in team */
async function pickAgentRoundRobin(teamId: string): Promise<string | null> {
  const members = await db
    .select({
      staffUserId: helpdeskTeamMember.staffUserId,
      activeCaseCount: helpdeskTeamMember.activeCaseCount,
    })
    .from(helpdeskTeamMember)
    .where(and(
      eq(helpdeskTeamMember.teamId, teamId),
      eq(helpdeskTeamMember.isAvailable, true),
    ))
    .orderBy(asc(helpdeskTeamMember.activeCaseCount))
    .limit(1);

  return members[0]?.staffUserId ?? null;
}

/**
 * Evaluate all active routing rules and return routing result.
 * First matching rule wins.
 */
export async function evaluateRoutingRules(caseData: CaseRoutingInput): Promise<RoutingResult> {
  const rules = await db
    .select()
    .from(helpdeskRoutingRule)
    .where(eq(helpdeskRoutingRule.isActive, true))
    .orderBy(asc(helpdeskRoutingRule.sortOrder));

  for (const rule of rules) {
    const conditions = rule.conditionsJson as RoutingCondition[];
    const allMatch = conditions.every(c => evaluateCondition(c, caseData));

    if (!allMatch) continue;

    const actions = rule.actionsJson as RoutingActions;
    const assignedTeamId = actions.assignTeamId ?? null;
    let assignedAgentId = actions.assignAgentId ?? null;
    const priority = (actions.setPriority ?? caseData.priority) as CasePriority;
    const tags = [...(caseData.tags ?? []), ...(actions.addTags ?? [])];
    const category = actions.setCategory ?? null;

    // Round-robin within team if no specific agent assigned
    if (assignedTeamId && !assignedAgentId) {
      assignedAgentId = await pickAgentRoundRobin(assignedTeamId);
    }

    return { assignedTeamId, assignedAgentId, priority, tags, category };
  }

  // No rule matched — assign to default team
  const defaultTeam = await db
    .select({ id: helpdeskTeam.id })
    .from(helpdeskTeam)
    .where(eq(helpdeskTeam.isDefault, true))
    .limit(1);

  const defaultTeamId = defaultTeam[0]?.id ?? null;
  let defaultAgentId: string | null = null;
  if (defaultTeamId) {
    defaultAgentId = await pickAgentRoundRobin(defaultTeamId);
  }

  return {
    assignedTeamId: defaultTeamId,
    assignedAgentId: defaultAgentId,
    priority: caseData.priority,
    tags: caseData.tags ?? [],
    category: null,
  };
}
