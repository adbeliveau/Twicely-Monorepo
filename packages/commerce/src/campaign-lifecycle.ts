/**
 * V4-06: Campaign Lifecycle State Machine
 *
 * Manages campaign status transitions, side effects (enable/disable linked promotions),
 * and scheduling of activate/deactivate tasks.
 */

import { db } from '@twicely/db';
import {
  promotionCampaign,
  campaignPromotion,
  scheduledPromoTask,
  promotion,
} from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '@twicely/logger';

// --- Types ------------------------------------------------------------------

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELED';

// --- Valid Transitions ------------------------------------------------------

export const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT:     ['SCHEDULED', 'CANCELED'],
  SCHEDULED: ['ACTIVE', 'PAUSED', 'CANCELED'],
  ACTIVE:    ['PAUSED', 'COMPLETED', 'CANCELED'],
  PAUSED:    ['ACTIVE', 'CANCELED', 'COMPLETED'],
  COMPLETED: [],
  CANCELED:  [],
};

// --- Helpers ----------------------------------------------------------------

/** Enable or disable all promotions linked to a campaign. */
async function setLinkedPromotionState(campaignId: string, isActive: boolean): Promise<void> {
  const links = await db
    .select({ promotionId: campaignPromotion.promotionId })
    .from(campaignPromotion)
    .where(eq(campaignPromotion.campaignId, campaignId));

  if (links.length === 0) return;

  const ids = links.map((l) => l.promotionId);
  await db
    .update(promotion)
    .set({ isActive, updatedAt: new Date() })
    .where(inArray(promotion.id, ids));

  logger.info('[campaign-lifecycle] Set linked promotions state', {
    campaignId,
    isActive,
    count: ids.length,
  });
}

/** Cancel all pending scheduled tasks for a campaign. */
async function cancelPendingTasks(campaignId: string): Promise<void> {
  await db
    .update(scheduledPromoTask)
    .set({ status: 'canceled', executedAt: new Date() })
    .where(
      and(
        eq(scheduledPromoTask.campaignId, campaignId),
        eq(scheduledPromoTask.status, 'pending'),
      ),
    );
}

// --- Core Functions ---------------------------------------------------------

/**
 * Transition a campaign to a new status. Validates the transition,
 * updates the DB, and fires side effects.
 */
export async function updateCampaignStatus(
  campaignId: string,
  newStatus: CampaignStatus,
  staffId?: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const [campaign] = await db
    .select({ id: promotionCampaign.id, status: promotionCampaign.status })
    .from(promotionCampaign)
    .where(eq(promotionCampaign.id, campaignId))
    .limit(1);

  if (!campaign) {
    return { success: false, error: 'Campaign not found' };
  }

  const currentStatus = campaign.status as CampaignStatus;
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Invalid transition from ${currentStatus} to ${newStatus}`,
    };
  }

  await db
    .update(promotionCampaign)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(promotionCampaign.id, campaignId));

  logger.info('[campaign-lifecycle] Status updated', {
    campaignId,
    from: currentStatus,
    to: newStatus,
    staffId,
    reason,
  });

  // --- Side effects ---
  switch (newStatus) {
    case 'ACTIVE':
      await setLinkedPromotionState(campaignId, true);
      break;

    case 'PAUSED':
    case 'COMPLETED':
      await setLinkedPromotionState(campaignId, false);
      break;

    case 'CANCELED':
      await setLinkedPromotionState(campaignId, false);
      await cancelPendingTasks(campaignId);
      break;
  }

  return { success: true };
}

/**
 * Create activate and deactivate scheduled tasks for a campaign.
 * Uses the campaign's startsAt and endsAt timestamps.
 */
export async function scheduleCampaignTasks(
  campaignId: string,
): Promise<{ activateTaskId: string; deactivateTaskId: string }> {
  const [campaign] = await db
    .select({
      id: promotionCampaign.id,
      startsAt: promotionCampaign.startsAt,
      endsAt: promotionCampaign.endsAt,
    })
    .from(promotionCampaign)
    .where(eq(promotionCampaign.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const [activateTask] = await db
    .insert(scheduledPromoTask)
    .values({
      campaignId,
      taskType: 'activate',
      scheduledFor: campaign.startsAt,
      status: 'pending',
    })
    .returning({ id: scheduledPromoTask.id });

  const [deactivateTask] = await db
    .insert(scheduledPromoTask)
    .values({
      campaignId,
      taskType: 'deactivate',
      scheduledFor: campaign.endsAt,
      status: 'pending',
    })
    .returning({ id: scheduledPromoTask.id });

  logger.info('[campaign-lifecycle] Scheduled campaign tasks', {
    campaignId,
    activateAt: campaign.startsAt.toISOString(),
    deactivateAt: campaign.endsAt.toISOString(),
  });

  return {
    activateTaskId: activateTask!.id,
    deactivateTaskId: deactivateTask!.id,
  };
}
