import { db } from '@twicely/db';
import { helpdeskRoutingRule } from '@twicely/db/schema';
import { asc } from 'drizzle-orm';

export interface RoutingRuleRow {
  id: string;
  name: string;
  conditionsJson: unknown;
  actionsJson: unknown;
  sortOrder: number;
  isActive: boolean;
}

/** Get all routing rules ordered by sort order */
export async function getAllRoutingRulesWithTeams(): Promise<RoutingRuleRow[]> {
  return db
    .select({
      id: helpdeskRoutingRule.id,
      name: helpdeskRoutingRule.name,
      conditionsJson: helpdeskRoutingRule.conditionsJson,
      actionsJson: helpdeskRoutingRule.actionsJson,
      sortOrder: helpdeskRoutingRule.sortOrder,
      isActive: helpdeskRoutingRule.isActive,
    })
    .from(helpdeskRoutingRule)
    .orderBy(asc(helpdeskRoutingRule.sortOrder));
}
