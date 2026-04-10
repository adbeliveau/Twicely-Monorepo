/**
 * Dispute Rule CRUD + Seed Defaults
 *
 * CRUD operations for auto-resolution rules managed by Trust & Safety staff.
 * Includes seed function for the 5 default rules from the canonical.
 */

import { db } from '@twicely/db';
import { disputeRule } from '@twicely/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import type { CreateRuleInput, UpdateRuleInput, RuleConditions, RuleAction, RuleActionParams } from './types';

/**
 * Create a new auto-resolution rule.
 */
export async function createDisputeRule(input: CreateRuleInput) {
  const [row] = await db
    .insert(disputeRule)
    .values({
      name:             input.name,
      ruleType:         input.ruleType,
      priority:         input.priority,
      conditions:       input.conditions,
      action:           input.action,
      actionParams:     input.actionParams ?? {},
      isActive:         true,
      createdByStaffId: input.staffId,
    })
    .returning();

  return row;
}

/**
 * Update an existing rule. Bumps updatedAt.
 */
export async function updateDisputeRule(
  ruleId: string,
  updates: UpdateRuleInput,
  _staffId: string
) {
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined)         setValues.name = updates.name;
  if (updates.ruleType !== undefined)     setValues.ruleType = updates.ruleType;
  if (updates.priority !== undefined)     setValues.priority = updates.priority;
  if (updates.conditions !== undefined)   setValues.conditions = updates.conditions;
  if (updates.action !== undefined)       setValues.action = updates.action;
  if (updates.actionParams !== undefined) setValues.actionParams = updates.actionParams;
  if (updates.isActive !== undefined)     setValues.isActive = updates.isActive;

  const [row] = await db
    .update(disputeRule)
    .set(setValues)
    .where(eq(disputeRule.id, ruleId))
    .returning();

  return row ?? null;
}

/**
 * Toggle a rule's isActive flag.
 */
export async function toggleDisputeRule(
  ruleId: string,
  isActive: boolean,
  _staffId: string
) {
  const [row] = await db
    .update(disputeRule)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(disputeRule.id, ruleId))
    .returning();

  return row ?? null;
}

/**
 * List all rules, sorted by priority ASC. Optionally filter by isActive.
 */
export async function listDisputeRules(filters?: { isActive?: boolean }) {
  if (filters?.isActive !== undefined) {
    return db
      .select()
      .from(disputeRule)
      .where(eq(disputeRule.isActive, filters.isActive))
      .orderBy(asc(disputeRule.priority));
  }
  return db
    .select()
    .from(disputeRule)
    .orderBy(asc(disputeRule.priority));
}

/**
 * Get a single rule by ID.
 */
export async function getDisputeRule(ruleId: string) {
  const [row] = await db
    .select()
    .from(disputeRule)
    .where(eq(disputeRule.id, ruleId))
    .limit(1);
  return row ?? null;
}

/**
 * Delete a rule by ID.
 */
export async function deleteDisputeRule(ruleId: string) {
  const [row] = await db
    .delete(disputeRule)
    .where(eq(disputeRule.id, ruleId))
    .returning({ id: disputeRule.id });
  return row ?? null;
}

// ─── Seed Defaults ───────────────────────────────────────────────────────────

interface DefaultRule {
  name: string;
  ruleType: string;
  priority: number;
  conditions: RuleConditions;
  action: RuleAction;
  actionParams: RuleActionParams;
}

const DEFAULT_RULES: ReadonlyArray<DefaultRule> = [
  {
    name: 'Auto-close on delivery confirmation',
    ruleType: 'auto_close_delivered',
    priority: 10,
    conditions: { deliveryConfirmed: true, daysSinceDelivery: 3 },
    action: 'close_seller_favor',
    actionParams: {},
  },
  {
    name: 'Auto-refund on no tracking',
    ruleType: 'refund_on_no_tracking',
    priority: 20,
    conditions: { hasTracking: false, daysSinceOpen: 7 },
    action: 'close_buyer_favor',
    actionParams: {},
  },
  {
    name: 'Auto-refund low value order',
    ruleType: 'auto_refund_low_value',
    priority: 25,
    conditions: { orderTotalCentsMax: 2000, daysSinceOpen: 2 },
    action: 'close_buyer_favor',
    actionParams: {},
  },
  {
    name: 'Auto-escalate seller no response',
    ruleType: 'auto_escalate',
    priority: 30,
    conditions: { sellerResponded: false, daysSinceOpen: 3 },
    action: 'escalate',
    actionParams: {},
  },
  {
    name: 'Auto-close on inactivity',
    ruleType: 'auto_close_no_response',
    priority: 100,
    conditions: { daysSinceOpen: 14 },
    action: 'close_seller_favor',
    actionParams: {},
  },
];

/**
 * Seed the 5 default auto-resolution rules.
 * Uses upsert on `name` to be idempotent.
 */
export async function seedDefaultRules(): Promise<number> {
  let seeded = 0;
  for (const rule of DEFAULT_RULES) {
    await db
      .insert(disputeRule)
      .values({
        name:             rule.name,
        ruleType:         rule.ruleType,
        priority:         rule.priority,
        conditions:       rule.conditions,
        action:           rule.action,
        actionParams:     rule.actionParams,
        isActive:         true,
        createdByStaffId: 'system',
      })
      .onConflictDoNothing({ target: disputeRule.name });
    seeded++;
  }
  return seeded;
}
