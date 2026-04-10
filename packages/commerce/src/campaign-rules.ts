/**
 * V4-06: Campaign Rules Engine
 *
 * Evaluates campaign eligibility rules, and CRUD for rule management.
 */

import { db } from '@twicely/db';
import { campaignRule } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';

// --- Types ------------------------------------------------------------------

export interface CampaignRuleCondition {
  ruleType: string;
  condition: Record<string, unknown>;
}

export interface EvaluateRulesInput {
  campaignId: string;
  orderTotalCents: number;
  buyerOrderCount: number;
  categoryIds: string[];
  listingIds: string[];
  sellerTier?: string;
}

// Tier ordering for seller_tier rule evaluation
const TIER_ORDER: Record<string, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  PREMIUM: 3,
  ENTERPRISE: 4,
};

// --- Core Functions ---------------------------------------------------------

/**
 * Evaluate all active rules for a campaign against the given context.
 * Returns eligible = true only if ALL rules pass.
 */
export async function evaluateCampaignRules(
  input: EvaluateRulesInput,
): Promise<{ eligible: boolean; failedRules: string[] }> {
  const rules = await db
    .select({
      id: campaignRule.id,
      ruleType: campaignRule.ruleType,
      condition: campaignRule.condition,
    })
    .from(campaignRule)
    .where(
      and(
        eq(campaignRule.campaignId, input.campaignId),
        eq(campaignRule.isActive, true),
      ),
    );

  if (rules.length === 0) {
    return { eligible: true, failedRules: [] };
  }

  const failedRules: string[] = [];

  for (const rule of rules) {
    const condition = rule.condition as Record<string, unknown>;
    const passed = evaluateRule(rule.ruleType, condition, input);
    if (!passed) {
      failedRules.push(rule.ruleType);
    }
  }

  return {
    eligible: failedRules.length === 0,
    failedRules,
  };
}

function evaluateRule(
  ruleType: string,
  condition: Record<string, unknown>,
  input: EvaluateRulesInput,
): boolean {
  switch (ruleType) {
    case 'min_order':
      return input.orderTotalCents >= (condition.minCents as number);

    case 'category_match': {
      const requiredIds = condition.categoryIds as string[];
      return input.categoryIds.some((id) => requiredIds.includes(id));
    }

    case 'listing_set': {
      const requiredIds = condition.listingIds as string[];
      return input.listingIds.some((id) => requiredIds.includes(id));
    }

    case 'seller_tier': {
      const minTier = condition.minTier as string;
      const minLevel = TIER_ORDER[minTier] ?? 0;
      const currentLevel = TIER_ORDER[input.sellerTier ?? 'FREE'] ?? 0;
      return currentLevel >= minLevel;
    }

    case 'new_user_only':
      return input.buyerOrderCount <= (condition.maxOrderCount as number);

    default:
      // Unknown rule types fail closed
      return false;
  }
}

/**
 * Add a rule to a campaign.
 */
export async function addCampaignRule(args: {
  campaignId: string;
  ruleType: string;
  condition: Record<string, unknown>;
}): Promise<typeof campaignRule.$inferSelect> {
  const [inserted] = await db
    .insert(campaignRule)
    .values({
      campaignId: args.campaignId,
      ruleType: args.ruleType,
      condition: args.condition,
    })
    .returning();

  return inserted;
}

/**
 * Remove a rule by ID.
 */
export async function removeCampaignRule(ruleId: string): Promise<void> {
  await db
    .delete(campaignRule)
    .where(eq(campaignRule.id, ruleId));
}

/**
 * Get all rules for a campaign.
 */
export async function getCampaignRules(
  campaignId: string,
): Promise<(typeof campaignRule.$inferSelect)[]> {
  return db
    .select()
    .from(campaignRule)
    .where(eq(campaignRule.campaignId, campaignId));
}
