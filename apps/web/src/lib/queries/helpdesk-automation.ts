import { db } from '@twicely/db';
import { helpdeskAutomationRule } from '@twicely/db/schema';
import { asc } from 'drizzle-orm';

export interface AutomationRuleRow {
  id: string;
  name: string;
  triggerEvent: string;
  conditionsJson: unknown;
  actionsJson: unknown;
  sortOrder: number;
  isActive: boolean;
}

/** Get all automation rules for the management page */
export async function getAllAutomationRules(): Promise<AutomationRuleRow[]> {
  return db
    .select({
      id: helpdeskAutomationRule.id,
      name: helpdeskAutomationRule.name,
      triggerEvent: helpdeskAutomationRule.triggerEvent,
      conditionsJson: helpdeskAutomationRule.conditionsJson,
      actionsJson: helpdeskAutomationRule.actionsJson,
      sortOrder: helpdeskAutomationRule.sortOrder,
      isActive: helpdeskAutomationRule.isActive,
    })
    .from(helpdeskAutomationRule)
    .orderBy(asc(helpdeskAutomationRule.sortOrder));
}
