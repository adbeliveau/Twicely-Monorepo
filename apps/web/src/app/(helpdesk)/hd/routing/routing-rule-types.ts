export type ConditionField = "type" | "channel" | "priority" | "subject" | "tags" | "requesterType";
export type ConditionOperator = "eq" | "in" | "contains" | "gte" | "lte" | "startsWith";

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface RuleAction {
  setPriority?: string;
  setCategory?: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  conditionsJson: unknown;
  actionsJson: unknown;
  sortOrder: number;
  isActive: boolean;
}
