/**
 * V4-06: Campaign Budget Monitor Worker
 *
 * BullMQ repeatable job that checks ACTIVE campaigns for budget/cap exhaustion
 * and auto-transitions to COMPLETED when thresholds are exceeded.
 * Uses DI factory pattern to avoid circular dep on @twicely/commerce.
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { promotionCampaign, campaignRedemption, campaignBudgetLog } from '@twicely/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// --- Callback Types (DI to avoid circular dep on @twicely/commerce) ---------

export interface CampaignBudgetMonitorHandlers {
  updateCampaignStatus: (
    campaignId: string,
    newStatus: string,
    staffId?: string,
    reason?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

// --- Queue ------------------------------------------------------------------

interface BudgetMonitorJobData {
  triggeredAt: string;
}

const QUEUE_NAME = 'campaign-budget-monitor';

export const campaignBudgetMonitorQueue = createQueue<BudgetMonitorJobData>(QUEUE_NAME);

// --- Registration -----------------------------------------------------------

/**
 * Register the campaign budget monitor repeatable job.
 * Reads tick pattern from platform_settings, defaults to every 5 minutes.
 */
export async function registerCampaignBudgetMonitorJob(): Promise<void> {
  const tickPattern = await getPlatformSetting(
    'promotions.budgetMonitor.tickPattern',
    '*/5 * * * *',
  );

  await campaignBudgetMonitorQueue.add(
    'tick',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'campaign-budget-monitor-tick',
      repeat: { pattern: tickPattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  logger.info('[campaign-budget-monitor] Registered repeatable job', { pattern: tickPattern });
}

// --- Worker Factory ---------------------------------------------------------

/**
 * Factory to create the campaign budget monitor worker.
 * Accepts handlers to avoid circular dep on @twicely/commerce.
 */
export function createCampaignBudgetMonitorWorker(handlers: CampaignBudgetMonitorHandlers) {
  return createWorker<BudgetMonitorJobData>(
    QUEUE_NAME,
    async () => {
      // Query all ACTIVE campaigns with a budget cap
      const campaigns = await db
        .select({
          id: promotionCampaign.id,
          budgetCents: promotionCampaign.budgetCents,
          spentCents: promotionCampaign.spentCents,
          maxRedemptions: promotionCampaign.maxRedemptions,
          autoDisableOnExhaust: promotionCampaign.autoDisableOnExhaust,
          budgetAlertPct: promotionCampaign.budgetAlertPct,
        })
        .from(promotionCampaign)
        .where(eq(promotionCampaign.status, 'ACTIVE'));

      if (campaigns.length === 0) return;

      for (const campaign of campaigns) {
        try {
          // Check budget exhaustion
          if (
            campaign.budgetCents !== null &&
            campaign.spentCents >= campaign.budgetCents &&
            campaign.autoDisableOnExhaust
          ) {
            await handlers.updateCampaignStatus(
              campaign.id,
              'COMPLETED',
              undefined,
              'Budget exhausted (monitor)',
            );
            logger.info('[campaign-budget-monitor] Campaign completed: budget exhausted', {
              campaignId: campaign.id,
            });
            continue;
          }

          // Check maxRedemptions cap
          if (campaign.maxRedemptions !== null) {
            const [redemptionRow] = await db
              .select({ cnt: count() })
              .from(campaignRedemption)
              .where(eq(campaignRedemption.campaignId, campaign.id));

            const redemptionCount = redemptionRow?.cnt ?? 0;
            if (redemptionCount >= campaign.maxRedemptions) {
              await handlers.updateCampaignStatus(
                campaign.id,
                'COMPLETED',
                undefined,
                'Max redemptions reached (monitor)',
              );
              logger.info('[campaign-budget-monitor] Campaign completed: max redemptions', {
                campaignId: campaign.id,
                redemptionCount,
                maxRedemptions: campaign.maxRedemptions,
              });
              continue;
            }
          }

          // Check budget alert threshold (only for campaigns with a budget)
          if (
            campaign.budgetCents !== null &&
            campaign.budgetAlertPct > 0
          ) {
            const alertThreshold = Math.floor(
              (campaign.budgetCents * campaign.budgetAlertPct) / 100,
            );

            if (campaign.spentCents >= alertThreshold) {
              // Check if alert already logged today
              const todayStart = new Date();
              todayStart.setUTCHours(0, 0, 0, 0);

              const [existing] = await db
                .select({ id: campaignBudgetLog.id })
                .from(campaignBudgetLog)
                .where(
                  and(
                    eq(campaignBudgetLog.campaignId, campaign.id),
                    eq(campaignBudgetLog.action, 'alert'),
                    sql`${campaignBudgetLog.createdAt} >= ${todayStart.toISOString()}`,
                  ),
                )
                .limit(1);

              if (!existing) {
                await db.insert(campaignBudgetLog).values({
                  campaignId: campaign.id,
                  action: 'alert',
                  amountCents: 0,
                  balanceCents: campaign.spentCents,
                  reason: `Budget alert: ${campaign.budgetAlertPct}% threshold exceeded`,
                });

                logger.warn('[campaign-budget-monitor] Budget alert threshold exceeded', {
                  campaignId: campaign.id,
                  pct: campaign.budgetAlertPct,
                  spentCents: campaign.spentCents,
                  budgetCents: campaign.budgetCents,
                });
              }
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('[campaign-budget-monitor] Error processing campaign', {
            campaignId: campaign.id,
            error: message,
          });
        }
      }
    },
    1,
  );
}

// --- Auto-instantiated worker -----------------------------------------------

void (async () => {
  const mod = await import('@twicely/commerce/campaign-lifecycle');
  createCampaignBudgetMonitorWorker({
    updateCampaignStatus: (campaignId, newStatus, staffId, reason) =>
      mod.updateCampaignStatus(
        campaignId,
        newStatus as Parameters<typeof mod.updateCampaignStatus>[1],
        staffId,
        reason,
      ),
  });
})();
