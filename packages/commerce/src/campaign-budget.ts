/**
 * V4-06: Campaign Budget Management
 *
 * Transactional spend recording, refunds, and budget adjustments
 * with automatic exhaustion handling.
 */

import { db } from '@twicely/db';
import {
  promotionCampaign,
  campaignBudgetLog,
  promotionUsage,
} from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { updateCampaignStatus } from './campaign-lifecycle';

// --- Types ------------------------------------------------------------------

export interface RecordSpendInput {
  campaignId: string;
  promotionId: string;
  orderId: string;
  buyerId: string;
  discountCents: number;
}

export interface RefundSpendInput {
  orderId: string;
  staffId?: string;
  reason?: string;
}

export interface AdjustBudgetInput {
  campaignId: string;
  newBudgetCents: number;
  staffId: string;
  reason: string;
}

// --- Core Functions ---------------------------------------------------------

/**
 * Record a promotion spend against a campaign budget.
 * Transactional: increments spentCents, inserts budget log,
 * and auto-completes campaign if budget exhausted.
 */
export async function recordPromotionSpend(
  input: RecordSpendInput,
): Promise<{ success: boolean; exhausted: boolean; error?: string }> {
  const { campaignId, orderId, discountCents } = input;

  return db.transaction(async (tx) => {
    // Lock and read current campaign state
    const [campaign] = await tx
      .select({
        id: promotionCampaign.id,
        status: promotionCampaign.status,
        budgetCents: promotionCampaign.budgetCents,
        spentCents: promotionCampaign.spentCents,
        autoDisableOnExhaust: promotionCampaign.autoDisableOnExhaust,
        budgetAlertPct: promotionCampaign.budgetAlertPct,
      })
      .from(promotionCampaign)
      .where(eq(promotionCampaign.id, campaignId))
      .limit(1);

    if (!campaign) {
      return { success: false, exhausted: false, error: 'Campaign not found' };
    }

    if (campaign.status !== 'ACTIVE') {
      return { success: false, exhausted: false, error: 'Campaign is not active' };
    }

    const newSpent = campaign.spentCents + discountCents;

    // Update spentCents atomically
    await tx
      .update(promotionCampaign)
      .set({
        spentCents: sql`${promotionCampaign.spentCents} + ${discountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(promotionCampaign.id, campaignId));

    // Insert budget log
    await tx.insert(campaignBudgetLog).values({
      campaignId,
      action: 'spend',
      amountCents: discountCents,
      balanceCents: newSpent,
      orderId,
    });

    // Check budget exhaustion
    const exhausted =
      campaign.budgetCents !== null && newSpent >= campaign.budgetCents;

    if (exhausted && campaign.autoDisableOnExhaust) {
      logger.warn('[campaign-budget] Budget exhausted, auto-completing campaign', {
        campaignId,
        budgetCents: campaign.budgetCents,
        spentCents: newSpent,
      });
    } else if (
      campaign.budgetCents !== null &&
      campaign.budgetAlertPct > 0 &&
      newSpent >= Math.floor((campaign.budgetCents * campaign.budgetAlertPct) / 100) &&
      campaign.spentCents < Math.floor((campaign.budgetCents * campaign.budgetAlertPct) / 100)
    ) {
      // First time crossing alert threshold
      logger.warn('[campaign-budget] Budget alert threshold crossed', {
        campaignId,
        pct: campaign.budgetAlertPct,
        spentCents: newSpent,
        budgetCents: campaign.budgetCents,
      });
    }

    return { success: true, exhausted };
  }).then(async (result) => {
    // Auto-complete outside the transaction to allow the lifecycle side effects
    if (result.success && result.exhausted) {
      const [campaign] = await db
        .select({ autoDisableOnExhaust: promotionCampaign.autoDisableOnExhaust })
        .from(promotionCampaign)
        .where(eq(promotionCampaign.id, campaignId))
        .limit(1);

      if (campaign?.autoDisableOnExhaust) {
        await updateCampaignStatus(campaignId, 'COMPLETED', undefined, 'Budget exhausted');
      }
    }
    return result;
  });
}

/**
 * Refund a promotion spend from a campaign budget.
 * Looks up the original spend via promotionUsage by orderId,
 * then decrements spentCents and inserts a refund log.
 */
export async function refundPromotionSpend(
  input: RefundSpendInput,
): Promise<{ success: boolean; error?: string }> {
  const { orderId, staffId, reason } = input;

  // Find the original usage record
  const [usage] = await db
    .select({
      id: promotionUsage.id,
      promotionId: promotionUsage.promotionId,
      discountCents: promotionUsage.discountCents,
    })
    .from(promotionUsage)
    .where(eq(promotionUsage.orderId, orderId))
    .limit(1);

  if (!usage) {
    return { success: false, error: 'No promotion usage found for this order' };
  }

  // Find the campaign that owns this promotion
  const campaignLinks = await db
    .select({
      campaignId: campaignBudgetLog.campaignId,
    })
    .from(campaignBudgetLog)
    .where(eq(campaignBudgetLog.orderId, orderId))
    .limit(1);

  if (campaignLinks.length === 0) {
    return { success: false, error: 'No campaign budget log found for this order' };
  }

  const campaignId = campaignLinks[0].campaignId;

  return db.transaction(async (tx) => {
    // Decrement spentCents
    await tx
      .update(promotionCampaign)
      .set({
        spentCents: sql`GREATEST(0, ${promotionCampaign.spentCents} - ${usage.discountCents})`,
        updatedAt: new Date(),
      })
      .where(eq(promotionCampaign.id, campaignId));

    // Read new balance for logging
    const [updated] = await tx
      .select({ spentCents: promotionCampaign.spentCents })
      .from(promotionCampaign)
      .where(eq(promotionCampaign.id, campaignId))
      .limit(1);

    // Insert refund log
    await tx.insert(campaignBudgetLog).values({
      campaignId,
      action: 'refund',
      amountCents: -usage.discountCents,
      balanceCents: updated?.spentCents ?? 0,
      orderId,
      staffId,
      reason: reason ?? 'Order refund',
    });

    logger.info('[campaign-budget] Refund recorded', {
      campaignId,
      orderId,
      refundCents: usage.discountCents,
    });

    return { success: true };
  });
}

/**
 * Adjust a campaign's total budget.
 * Updates budgetCents and inserts an adjustment log.
 */
export async function adjustCampaignBudget(
  input: AdjustBudgetInput,
): Promise<{ success: boolean; error?: string }> {
  const { campaignId, newBudgetCents, staffId, reason } = input;

  if (newBudgetCents < 0) {
    return { success: false, error: 'Budget cannot be negative' };
  }

  const [campaign] = await db
    .select({
      id: promotionCampaign.id,
      budgetCents: promotionCampaign.budgetCents,
      spentCents: promotionCampaign.spentCents,
    })
    .from(promotionCampaign)
    .where(eq(promotionCampaign.id, campaignId))
    .limit(1);

  if (!campaign) {
    return { success: false, error: 'Campaign not found' };
  }

  const oldBudget = campaign.budgetCents ?? 0;
  const delta = newBudgetCents - oldBudget;

  await db
    .update(promotionCampaign)
    .set({ budgetCents: newBudgetCents, updatedAt: new Date() })
    .where(eq(promotionCampaign.id, campaignId));

  await db.insert(campaignBudgetLog).values({
    campaignId,
    action: 'adjustment',
    amountCents: delta,
    balanceCents: campaign.spentCents,
    staffId,
    reason,
  });

  logger.info('[campaign-budget] Budget adjusted', {
    campaignId,
    oldBudget,
    newBudgetCents,
    delta,
    staffId,
  });

  return { success: true };
}
