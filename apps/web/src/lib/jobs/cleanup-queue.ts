/**
 * Cleanup Queue — G8.2
 *
 * Registers all cleanup repeatable jobs on the cleanup BullMQ queue.
 * Queue: concurrency 3, retry 1x, no dead letter (Feature Lock-in section 40).
 *
 * Jobs:
 * 1. account-deletion — daily at 04:00 UTC (from G8.1)
 * 2. session-cleanup  — every 6 hours
 * 3. audit-archive    — monthly 1st at 03:00 UTC
 * 4. data-purge       — daily at 04:30 UTC
 */

import { cleanupQueue, CLEANUP_QUEUE_NAME } from '@twicely/jobs/account-deletion-executor';
import { runSessionCleanup } from '@twicely/jobs/cleanup-session';
import { runAuditArchive } from '@twicely/jobs/cleanup-audit-archive';
import { runDataPurge } from '@twicely/jobs/cleanup-data-purge';
import { createWorker } from '@twicely/jobs/queue';
import { upsertPlatformSetting } from '@twicely/jobs/cleanup-helpers';
import { logger } from '@twicely/logger';
import type { CleanupJobData } from '@twicely/jobs/account-deletion-executor';

/** Register all cleanup repeatable jobs. Call once at startup. */
export async function registerCleanupJobs(): Promise<void> {
  // Account deletion executor — daily at 04:00 UTC
  await cleanupQueue.add(
    'cleanup:account-deletion',
    { task: 'account-deletion', triggeredAt: new Date().toISOString() },
    {
      jobId: 'cleanup-account-deletion',
      repeat: { pattern: '0 4 * * *' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );

  // Session cleanup — every 6 hours
  await cleanupQueue.add(
    'cleanup:session-cleanup',
    { task: 'session-cleanup', triggeredAt: new Date().toISOString() },
    {
      jobId: 'cleanup-session-cleanup',
      repeat: { pattern: '0 */6 * * *' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );

  // Audit archive — monthly 1st at 03:00 UTC
  await cleanupQueue.add(
    'cleanup:audit-archive',
    { task: 'audit-archive', triggeredAt: new Date().toISOString() },
    {
      jobId: 'cleanup-audit-archive',
      repeat: { pattern: '0 3 1 * *' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );

  // Data purge — daily at 04:30 UTC
  await cleanupQueue.add(
    'cleanup:data-purge',
    { task: 'data-purge', triggeredAt: new Date().toISOString() },
    {
      jobId: 'cleanup-data-purge',
      repeat: { pattern: '30 4 * * *' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );

  logger.info('[cleanupQueue] Registered 4 cleanup jobs');
}

/** Register the cleanup worker that processes all cleanup tasks. */
export function registerCleanupWorker(): void {
  createWorker<CleanupJobData>(
    CLEANUP_QUEUE_NAME,
    async (job) => {
      const { task } = job.data;

      switch (task) {
        case 'account-deletion': {
          const { runAccountDeletionBatch } = await import(
            './account-deletion-executor'
          );
          await runAccountDeletionBatch();
          await upsertPlatformSetting(
            'cleanup.accountDeletion.lastRunAt',
            new Date().toISOString()
          );
          await upsertPlatformSetting(
            'cleanup.accountDeletion.lastResult',
            'Completed'
          );
          break;
        }
        case 'session-cleanup': {
          await runSessionCleanup();
          break;
        }
        case 'audit-archive': {
          await runAuditArchive();
          break;
        }
        case 'data-purge': {
          await runDataPurge();
          break;
        }
        default: {
          logger.warn('[cleanupQueue] Unknown task', { task });
        }
      }
    },
    3 // concurrency 3 per Feature Lock-in section 40
  );
}
