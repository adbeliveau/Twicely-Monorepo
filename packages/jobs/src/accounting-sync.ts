/**
 * Accounting sync scheduled cron job — G10.3 Gap 1
 * Runs on a schedule to sync CONNECTED integrations with HOURLY/DAILY frequency.
 * Uses DI factory pattern (same as cron-jobs.ts) to avoid circular deps.
 */

import { db } from '@twicely/db';
import { accountingIntegration } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { createQueue, createWorker } from './queue';

const QUEUE_NAME = 'accounting-sync';

const MAX_CONSECUTIVE_ERRORS = 5;

interface AccountingSyncData {
  triggeredAt: string;
  frequency: 'HOURLY' | 'DAILY';
}

/** DI type for the sync handler — injected at runtime to avoid circular dep. */
export type SyncHandler = (integrationId: string) => Promise<{
  success: boolean;
  logId: string;
  recordsSynced: number;
  recordsFailed: number;
}>;

export const accountingSyncQueue = createQueue<AccountingSyncData>(QUEUE_NAME);

/**
 * Process a scheduled accounting sync.
 * Finds CONNECTED integrations matching the given frequency and runs sync.
 */
export async function processAccountingSync(
  frequency: 'HOURLY' | 'DAILY',
  runFullSync: SyncHandler,
): Promise<{
  synced: number;
  failed: number;
  disabled: number;
}> {
  const batchSize = await getPlatformSetting<number>('accounting.sync.batchSize', 50);

  // Find CONNECTED integrations with matching frequency
  const integrations = await db
    .select({
      id: accountingIntegration.id,
      userId: accountingIntegration.userId,
      provider: accountingIntegration.provider,
      syncErrorCount: accountingIntegration.syncErrorCount,
    })
    .from(accountingIntegration)
    .where(
      and(
        eq(accountingIntegration.status, 'CONNECTED'),
        eq(accountingIntegration.syncFrequency, frequency),
      ),
    )
    .limit(batchSize);

  let synced = 0;
  let failed = 0;
  let disabled = 0;

  for (const integration of integrations) {
    try {
      const result = await runFullSync(integration.id);

      if (result.success) {
        // Reset error count on success
        if (integration.syncErrorCount > 0) {
          await db
            .update(accountingIntegration)
            .set({ syncErrorCount: 0, updatedAt: new Date() })
            .where(eq(accountingIntegration.id, integration.id));
        }
        synced++;
      } else {
        // Increment error count
        const newErrorCount = integration.syncErrorCount + 1;

        if (newErrorCount >= MAX_CONSECUTIVE_ERRORS) {
          // Auto-disable integration after threshold
          await db
            .update(accountingIntegration)
            .set({
              lastSyncStatus: 'ERROR',
              syncErrorCount: newErrorCount,
              updatedAt: new Date(),
            })
            .where(eq(accountingIntegration.id, integration.id));

          // Notify seller of auto-disable
          try {
            const { notify } = await import('@twicely/notifications/service');
            await notify(integration.userId, 'accounting.sync.failed', {
              provider: integration.provider,
              reason: `Automatically disabled after ${MAX_CONSECUTIVE_ERRORS} consecutive sync failures`,
            });
          } catch {
            // Fire-and-forget
          }

          disabled++;
          logger.warn('[accounting-sync] Auto-disabled integration', {
            integrationId: integration.id,
            errorCount: newErrorCount,
          });
        } else {
          await db
            .update(accountingIntegration)
            .set({
              syncErrorCount: newErrorCount,
              updatedAt: new Date(),
            })
            .where(eq(accountingIntegration.id, integration.id));
          failed++;
        }
      }
    } catch (err) {
      const newErrorCount = integration.syncErrorCount + 1;
      await db
        .update(accountingIntegration)
        .set({
          syncErrorCount: newErrorCount,
          lastSyncStatus: 'FAILED',
          updatedAt: new Date(),
        })
        .where(eq(accountingIntegration.id, integration.id));

      if (newErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        await db
          .update(accountingIntegration)
          .set({ lastSyncStatus: 'ERROR' })
          .where(eq(accountingIntegration.id, integration.id));
        disabled++;
      } else {
        failed++;
      }

      logger.error('[accounting-sync] Sync failed for integration', {
        integrationId: integration.id,
        error: String(err),
      });
    }
  }

  logger.info('[accounting-sync] Batch complete', { frequency, synced, failed, disabled });
  return { synced, failed, disabled };
}

export async function registerAccountingSyncJobs(): Promise<void> {
  const cronPattern = await getPlatformSetting<string>(
    'accounting.sync.cronPattern',
    '0 * * * *',
  );

  // Hourly sync
  await accountingSyncQueue.add(
    'cron:accounting-sync-hourly',
    { triggeredAt: new Date().toISOString(), frequency: 'HOURLY' },
    {
      jobId: 'cron-accounting-sync-hourly',
      repeat: { pattern: cronPattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  // Daily sync (2 AM UTC)
  await accountingSyncQueue.add(
    'cron:accounting-sync-daily',
    { triggeredAt: new Date().toISOString(), frequency: 'DAILY' },
    {
      jobId: 'cron-accounting-sync-daily',
      repeat: { pattern: '0 2 * * *', tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

/**
 * Factory to create the accounting sync worker.
 * SyncHandler is injected to avoid circular dep on web app code.
 */
export function createAccountingSyncWorker(syncHandler: SyncHandler) {
  return createWorker<AccountingSyncData>(
    QUEUE_NAME,
    async (job) => {
      await processAccountingSync(job.data.frequency, syncHandler);
    },
    1,
  );
}
