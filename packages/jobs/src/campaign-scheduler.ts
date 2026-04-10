/**
 * V4-06: Campaign Scheduler Worker
 *
 * BullMQ repeatable job that processes pending scheduled promotion tasks.
 * Uses DI factory pattern to avoid circular dep on @twicely/commerce.
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { scheduledPromoTask } from '@twicely/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// --- Callback Types (DI to avoid circular dep on @twicely/commerce) ---------

export interface CampaignSchedulerHandlers {
  updateCampaignStatus: (
    campaignId: string,
    newStatus: string,
    staffId?: string,
    reason?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

// --- Queue ------------------------------------------------------------------

interface CampaignSchedulerJobData {
  triggeredAt: string;
}

const QUEUE_NAME = 'campaign-scheduler';

export const campaignSchedulerQueue = createQueue<CampaignSchedulerJobData>(QUEUE_NAME);

// --- Registration -----------------------------------------------------------

/**
 * Register the campaign scheduler repeatable job.
 * Reads tick pattern from platform_settings, defaults to every minute.
 */
export async function registerCampaignSchedulerJob(): Promise<void> {
  const tickPattern = await getPlatformSetting(
    'promotions.scheduler.tickPattern',
    '* * * * *',
  );

  await campaignSchedulerQueue.add(
    'tick',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'campaign-scheduler-tick',
      repeat: { pattern: tickPattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  logger.info('[campaign-scheduler] Registered repeatable job', { pattern: tickPattern });
}

// --- Worker Factory ---------------------------------------------------------

/**
 * Factory to create the campaign scheduler worker.
 * Accepts handlers to avoid circular dep on @twicely/commerce.
 */
export function createCampaignSchedulerWorker(handlers: CampaignSchedulerHandlers) {
  return createWorker<CampaignSchedulerJobData>(
    QUEUE_NAME,
    async () => {
      const now = new Date();

      // Query all pending tasks whose scheduledFor <= now
      const tasks = await db
        .select({
          id: scheduledPromoTask.id,
          campaignId: scheduledPromoTask.campaignId,
          taskType: scheduledPromoTask.taskType,
        })
        .from(scheduledPromoTask)
        .where(
          and(
            lte(scheduledPromoTask.scheduledFor, now),
            eq(scheduledPromoTask.status, 'pending'),
          ),
        );

      if (tasks.length === 0) return;

      logger.info('[campaign-scheduler] Processing pending tasks', { count: tasks.length });

      for (const task of tasks) {
        try {
          let newStatus: string;
          if (task.taskType === 'activate') {
            newStatus = 'ACTIVE';
          } else if (task.taskType === 'deactivate') {
            newStatus = 'COMPLETED';
          } else {
            logger.warn('[campaign-scheduler] Unknown task type', { taskType: task.taskType });
            continue;
          }

          const result = await handlers.updateCampaignStatus(
            task.campaignId,
            newStatus,
            undefined,
            `Scheduled ${task.taskType}`,
          );

          if (result.success) {
            await db
              .update(scheduledPromoTask)
              .set({ status: 'executed', executedAt: new Date() })
              .where(eq(scheduledPromoTask.id, task.id));
          } else {
            await db
              .update(scheduledPromoTask)
              .set({ status: 'failed', errorMessage: result.error, executedAt: new Date() })
              .where(eq(scheduledPromoTask.id, task.id));

            logger.error('[campaign-scheduler] Task failed', {
              taskId: task.id,
              error: result.error,
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await db
            .update(scheduledPromoTask)
            .set({ status: 'failed', errorMessage: message, executedAt: new Date() })
            .where(eq(scheduledPromoTask.id, task.id));

          logger.error('[campaign-scheduler] Task error', {
            taskId: task.id,
            error: message,
          });
        }
      }
    },
    1,
  );
}

// --- Auto-instantiated worker -----------------------------------------------
// Lazy-initialized after commerce loads to avoid circular dep.

void (async () => {
  const mod = await import('@twicely/commerce/campaign-lifecycle');
  createCampaignSchedulerWorker({
    updateCampaignStatus: (campaignId, newStatus, staffId, reason) =>
      mod.updateCampaignStatus(
        campaignId,
        newStatus as Parameters<typeof mod.updateCampaignStatus>[1],
        staffId,
        reason,
      ),
  });
})();
