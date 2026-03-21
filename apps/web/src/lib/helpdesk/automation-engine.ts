/**
 * Helpdesk Automation Engine
 *
 * Evaluates active automation rules against a trigger event + case data,
 * and executes the matching actions.
 *
 * Per TWICELY_V3_HELPDESK_CANONICAL.md §13.
 */

import { db } from '@twicely/db';
import { helpdeskAutomationRule, helpdeskCase, caseEvent, caseMessage } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { sql } from 'drizzle-orm';

interface CaseData {
  id: string;
  type: string;
  priority: string;
  status: string;
  channel: string;
  tags: string[];
  requesterId: string;
  assignedTeamId: string | null;
  assignedAgentId: string | null;
}

type ConditionOperator = 'eq' | 'neq' | 'in' | 'contains';

interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

interface Action {
  type: string;
  value?: unknown;
}

function evaluateCondition(caseData: CaseData, cond: Condition): boolean {
  const caseFields: Record<string, unknown> = { ...caseData };
  const fieldValue = caseFields[cond.field];
  switch (cond.operator) {
    case 'eq': return fieldValue === cond.value;
    case 'neq': return fieldValue !== cond.value;
    case 'in': return Array.isArray(cond.value) && (cond.value as unknown[]).includes(fieldValue);
    case 'contains':
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(String(cond.value).toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return (fieldValue as unknown[]).includes(cond.value);
      }
      return false;
    default: return false;
  }
}

/**
 * Evaluate automation rules for a given trigger event and case.
 * Executes actions for all matching rules (not first-match-wins).
 */
export async function evaluateAutomationRules(
  triggerEvent: string,
  caseData: CaseData
): Promise<void> {
  const rules = await db
    .select()
    .from(helpdeskAutomationRule)
    .where(
      and(
        eq(helpdeskAutomationRule.isActive, true),
        eq(helpdeskAutomationRule.triggerEvent, triggerEvent)
      )
    );

  const now = new Date();

  for (const rule of rules) {
    const conditions = Array.isArray(rule.conditionsJson) ? (rule.conditionsJson as Condition[]) : [];

    const matches = conditions.every((cond) => evaluateCondition(caseData, cond));
    if (!matches) continue;

    const actions = Array.isArray(rule.actionsJson) ? (rule.actionsJson as Action[]) : [];
    let hasUpdate = false;
    const updateFields: Record<string, unknown> = {};

    for (const action of actions) {
      switch (action.type) {
        case 'SET_STATUS':
          updateFields['status'] = action.value;
          hasUpdate = true;
          break;
        case 'ASSIGN_TEAM':
          updateFields['assignedTeamId'] = action.value;
          hasUpdate = true;
          break;
        case 'ASSIGN_AGENT':
          updateFields['assignedAgentId'] = action.value;
          hasUpdate = true;
          break;
        case 'SET_PRIORITY':
          updateFields['priority'] = action.value;
          hasUpdate = true;
          break;
        case 'ADD_TAGS':
          if (typeof action.value === 'string') {
            await db.update(helpdeskCase)
              .set({ tags: sql`array_append(${helpdeskCase.tags}, ${action.value})`, updatedAt: now })
              .where(eq(helpdeskCase.id, caseData.id));
          }
          break;
        case 'ADD_NOTE':
          await db.insert(caseMessage).values({
            caseId: caseData.id,
            senderType: 'system',
            direction: 'INTERNAL',
            body: String(action.value ?? ''),
          });
          break;
      }
    }

    if (hasUpdate) {
      updateFields['updatedAt'] = now;
      updateFields['lastActivityAt'] = now;
      await db.update(helpdeskCase)
        .set(updateFields)
        .where(eq(helpdeskCase.id, caseData.id));
    }

    await db.insert(caseEvent).values({
      caseId: caseData.id,
      eventType: 'automation_applied',
      actorType: 'system',
      actorId: null,
      dataJson: { ruleId: rule.id, ruleName: rule.name, trigger: triggerEvent },
    });

    logger.info('Automation rule applied', { ruleId: rule.id, caseId: caseData.id, trigger: triggerEvent });
  }
}
