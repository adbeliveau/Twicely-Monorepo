/**
 * Dispute Auto-Resolution Rule Engine
 *
 * Evaluates configurable rules against dispute context to determine whether
 * a dispute can be auto-resolved. Integrates with:
 *   - Seller protection score (bias from @twicely/scoring)
 *   - Decision #92 waterfall (via dispute-recovery.ts)
 *   - Immutable audit trail (disputeRuleExecution)
 *   - Timeline events
 */

import { db } from '@twicely/db';
import {
  disputeRule,
  disputeRuleExecution,
  dispute,
  order,
  shipment,
} from '@twicely/db/schema';
import { eq, asc } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import type {
  RuleConditions,
  RuleAction,
  RuleActionParams,
  DisputeContext,
  EvaluationResult,
  ResolutionBias,
} from './types';

/**
 * Build the context object from a dispute + its related order + shipment.
 */
export async function buildDisputeContext(
  disputeId: string
): Promise<DisputeContext | null> {
  const [disp] = await db
    .select({
      id:               dispute.id,
      orderId:          dispute.orderId,
      buyerId:          dispute.buyerId,
      sellerId:         dispute.sellerId,
      claimType:        dispute.claimType,
      status:           dispute.status,
      description:      dispute.description,
      sellerResponseNote: dispute.sellerResponseNote,
      createdAt:        dispute.createdAt,
    })
    .from(dispute)
    .where(eq(dispute.id, disputeId))
    .limit(1);

  if (!disp) return null;

  const [ord] = await db
    .select({
      totalCents:     order.totalCents,
      trackingNumber: order.trackingNumber,
      deliveredAt:    order.deliveredAt,
    })
    .from(order)
    .where(eq(order.id, disp.orderId))
    .limit(1);

  const [ship] = await db
    .select({
      tracking:    shipment.tracking,
      deliveredAt: shipment.deliveredAt,
      status:      shipment.status,
    })
    .from(shipment)
    .where(eq(shipment.orderId, disp.orderId))
    .limit(1);

  const now = new Date();
  const createdAt = disp.createdAt;
  const daysSinceOpen = Math.floor(
    (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  const hasTracking = !!(ship?.tracking || ord?.trackingNumber);
  const deliveredAt = ship?.deliveredAt ?? ord?.deliveredAt ?? null;
  const deliveryConfirmed = deliveredAt !== null || ship?.status === 'DELIVERED';

  let daysSinceDelivery: number | null = null;
  if (deliveredAt) {
    daysSinceDelivery = Math.floor(
      (now.getTime() - deliveredAt.getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  return {
    disputeId:         disp.id,
    orderId:           disp.orderId,
    buyerId:           disp.buyerId,
    sellerId:          disp.sellerId,
    claimType:         disp.claimType,
    status:            disp.status,
    orderTotalCents:   ord?.totalCents ?? 0,
    createdAt,
    daysSinceOpen,
    hasTracking,
    deliveryConfirmed,
    daysSinceDelivery,
    sellerResponded:   disp.sellerResponseNote !== null,
    buyerResponded:    true,
    isAutoResolvable:  true,
  };
}

/**
 * Get the auto-resolution bias for a seller based on their performance band.
 * Uses dynamic import to avoid circular dep (commerce -> scoring -> commerce).
 */
export async function getAutoResolutionBias(
  sellerId: string
): Promise<ResolutionBias> {
  try {
    const { deriveBand } = await import('@twicely/scoring/calculate-seller-score');
    // TODO: look up seller's current score from sellerPerformance table
    // For now return NEUTRAL until the scoring pipeline is wired
    void deriveBand; void sellerId;
    return 'NEUTRAL';
  } catch {
    logger.warn('Could not load seller scoring for auto-resolution bias', { sellerId });
    return 'NEUTRAL';
  }
}

function checkCondition(
  key: keyof RuleConditions,
  condValue: unknown,
  ctx: DisputeContext
): boolean {
  switch (key) {
    case 'deliveryConfirmed':
      return ctx.deliveryConfirmed === condValue;
    case 'daysSinceDelivery':
      return ctx.daysSinceDelivery !== null && ctx.daysSinceDelivery >= (condValue as number);
    case 'hasTracking':
      return ctx.hasTracking === condValue;
    case 'sellerResponded':
      return ctx.sellerResponded === condValue;
    case 'buyerResponded':
      return ctx.buyerResponded === condValue;
    case 'daysSinceOpen':
      return ctx.daysSinceOpen >= (condValue as number);
    case 'claimType':
      return ctx.claimType === condValue;
    case 'orderTotalCentsMax':
      return ctx.orderTotalCents <= (condValue as number);
    case 'buyerClaimCount90Days':
      return true;
    case 'sellerScoreBand':
      return true;
    case 'chargebackProbability':
      return true;
    default:
      return true;
  }
}

export async function evaluateRules(
  disputeId: string
): Promise<EvaluationResult> {
  const ctx = await buildDisputeContext(disputeId);
  if (!ctx) {
    return { shouldResolve: false };
  }

  if (!ctx.isAutoResolvable) {
    return { shouldResolve: false };
  }

  if (ctx.status !== 'OPEN') {
    return { shouldResolve: false };
  }

  const rules = await db
    .select()
    .from(disputeRule)
    .where(eq(disputeRule.isActive, true))
    .orderBy(asc(disputeRule.priority));

  if (rules.length === 0) {
    return { shouldResolve: false };
  }

  const bias = await getAutoResolutionBias(ctx.sellerId);

  for (const rule of rules) {
    const conditions = rule.conditions as RuleConditions;
    const action = rule.action as RuleAction;
    const actionParams = (rule.actionParams ?? {}) as RuleActionParams;

    let allMatch = true;
    for (const [key, value] of Object.entries(conditions)) {
      if (!checkCondition(key as keyof RuleConditions, value, ctx)) {
        allMatch = false;
        break;
      }
    }

    if (!allMatch) continue;

    if (bias === 'SELLER' && (action === 'close_buyer_favor' || action === 'refund_partial')) {
      await db.insert(disputeRuleExecution).values({
        disputeId,
        ruleId:     rule.id,
        ruleName:   rule.name,
        conditions: conditions,
        context:    ctx,
        action:     action,
        outcome:    'skipped_bias',
      });
      logger.info('Skipped buyer-favorable rule due to SELLER bias', {
        disputeId, ruleId: rule.id, ruleName: rule.name,
      });
      continue;
    }

    return {
      shouldResolve: true,
      rule: {
        id:           rule.id,
        name:         rule.name,
        action,
        actionParams,
        conditions,
      },
    };
  }

  return { shouldResolve: false };
}

export async function recordRuleExecution(params: {
  disputeId: string;
  ruleId: string;
  ruleName: string;
  conditions: RuleConditions;
  context: DisputeContext;
  action: RuleAction;
  outcome: 'success' | 'skipped_bias' | 'skipped_manual_override' | 'failed';
  errorMessage?: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(disputeRuleExecution)
    .values({
      disputeId:    params.disputeId,
      ruleId:       params.ruleId,
      ruleName:     params.ruleName,
      conditions:   params.conditions,
      context:      params.context,
      action:       params.action,
      outcome:      params.outcome,
      errorMessage: params.errorMessage ?? null,
    })
    .returning({ id: disputeRuleExecution.id });

  return { id: row.id };
}
