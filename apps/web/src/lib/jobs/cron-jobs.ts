/**
 * BullMQ repeatable jobs for platform cron tasks.
 * These wrap the same processing functions used by the HTTP cron routes,
 * but are triggered internally via BullMQ repeatable jobs instead of
 * requiring an external scheduler (Railway Cron).
 *
 * The HTTP routes at /api/cron/* remain as manual triggers / fallbacks.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const QUEUE_NAME = 'platform-cron';

type CronTask = 'orders' | 'returns' | 'shipping' | 'health' | 'vacation' | 'seller-score-recalc' | 'accounting-sync';

interface CronJobData {
  task: CronTask;
  triggeredAt: string;
}

export const cronQueue = createQueue<CronJobData>(QUEUE_NAME);

/** Register all platform cron repeatable jobs. Call once at startup. */
export async function registerCronJobs(): Promise<void> {
  // Load all cron patterns from platform settings (fallback to hardcoded defaults)
  const [
    ordersPattern,
    returnsPattern,
    shippingPattern,
    healthPattern,
    vacationPattern,
    sellerScorePattern,
    accountingSyncPattern,
  ] = await Promise.all([
    getPlatformSetting('jobs.cron.orders.pattern', '0 * * * *'),
    getPlatformSetting('jobs.cron.returns.pattern', '10 * * * *'),
    getPlatformSetting('jobs.cron.shipping.pattern', '20 * * * *'),
    getPlatformSetting('jobs.cron.health.pattern', '*/5 * * * *'),
    getPlatformSetting('jobs.cron.vacation.pattern', '0 0 * * *'),
    getPlatformSetting('jobs.cron.sellerScoreRecalc.pattern', '0 3 * * *'),
    getPlatformSetting('jobs.cron.accountingSync.pattern', '0 2 * * *'),
  ]);

  // Orders: auto-complete after escrow hold
  await cronQueue.add(
    'cron:orders',
    { task: 'orders', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-orders', repeat: { pattern: ordersPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );

  // Returns: auto-approve overdue
  await cronQueue.add(
    'cron:returns',
    { task: 'returns', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-returns', repeat: { pattern: returnsPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );

  // Shipping: scan for exceptions
  await cronQueue.add(
    'cron:shipping',
    { task: 'shipping', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-shipping', repeat: { pattern: shippingPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );

  // Health: doctor checks
  await cronQueue.add(
    'cron:health',
    { task: 'health', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-health', repeat: { pattern: healthPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 50 } },
  );

  // Vacation: auto-end expired vacation modes
  await cronQueue.add(
    'cron:vacation',
    { task: 'vacation', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-vacation', repeat: { pattern: vacationPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );

  // Seller score recalculation
  await cronQueue.add(
    'cron:seller-score-recalc',
    { task: 'seller-score-recalc', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-seller-score-recalc', repeat: { pattern: sellerScorePattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );

  // Accounting sync — daily at 2 AM UTC (G10.3)
  await cronQueue.add(
    'cron:accounting-sync',
    { task: 'accounting-sync', triggeredAt: new Date().toISOString() },
    { jobId: 'cron-accounting-sync', repeat: { pattern: accountingSyncPattern, tz: 'UTC' }, removeOnComplete: true, removeOnFail: { count: 100 } },
  );

  logger.info('[cronJobs] Registered 7 platform cron jobs');

  // Tax document generation — separate queue, January 15 annually
  const { registerTaxDocumentGenerationJob } = await import('./tax-document-generation');
  await registerTaxDocumentGenerationJob();
  logger.info('[cronJobs] Registered tax document generation cron job');

  // Affiliate suspension expiry — separate queue, daily at 2 AM UTC (§2.9 three-strikes)
  const { registerAffiliateSuspensionExpiryJob } = await import('./affiliate-suspension-expiry');
  await registerAffiliateSuspensionExpiryJob();
  logger.info('[cronJobs] Registered affiliate suspension expiry cron job');

  // GDPR cleanup queue — G8 (account deletion, session cleanup, audit archive, data purge)
  const { registerCleanupJobs, registerCleanupWorker } = await import('./cleanup-queue');
  await registerCleanupJobs();
  registerCleanupWorker();
  logger.info('[cronJobs] Registered cleanup queue jobs (G8)');

  // Helpdesk retention purge — daily at 4 AM UTC (G9.6)
  const { enqueueHelpdeskRetentionPurge } = await import('./helpdesk-retention-purge');
  await enqueueHelpdeskRetentionPurge();
  logger.info('[cronJobs] Registered helpdesk retention purge cron job');

  // Helpdesk auto-close — every 15 min (Helpdesk Canonical §17)
  const { enqueueHelpdeskAutoClose } = await import('./helpdesk-auto-close');
  await enqueueHelpdeskAutoClose();
  logger.info('[cronJobs] Registered helpdesk auto-close cron job');

  // Helpdesk SLA check — every 5 min (Helpdesk Canonical §12.4)
  const { enqueueHelpdeskSlaCheck } = await import('./helpdesk-sla-check');
  await enqueueHelpdeskSlaCheck();
  logger.info('[cronJobs] Registered helpdesk SLA check cron job');

  // Helpdesk CSAT send — every 5 min (Helpdesk Canonical §18)
  const { enqueueHelpdeskCsatSend } = await import('./helpdesk-csat-send');
  await enqueueHelpdeskCsatSend();
  logger.info('[cronJobs] Registered helpdesk CSAT send cron job');
}

async function processCronJob(task: CronTask): Promise<void> {
  switch (task) {
    case 'orders': {
      const { autoCompleteDeliveredOrders } = await import('@/lib/commerce/shipping');
      const count = await autoCompleteDeliveredOrders();
      logger.info('[cronJobs] orders complete', { autoCompleted: count });
      break;
    }
    case 'returns': {
      const { autoApproveOverdueReturns } = await import('@/lib/commerce/returns');
      const count = await autoApproveOverdueReturns();
      logger.info('[cronJobs] returns complete', { autoApproved: count });
      break;
    }
    case 'shipping': {
      const { scanForShippingExceptions } = await import('@/lib/commerce/shipping-exceptions');
      const found = await scanForShippingExceptions();
      logger.info('[cronJobs] shipping complete', { exceptionsFound: found });
      break;
    }
    case 'health': {
      const { runAllChecks } = await import('@/lib/monitoring/doctor-runner');
      const { sendSlackAlert } = await import('@/lib/monitoring/slack-alert');
      const summary = await runAllChecks();
      const failed = summary.checks.filter((c) => c.status !== 'HEALTHY');
      if (failed.length > 0) {
        await sendSlackAlert(summary);
      }
      logger.info('[cronJobs] health complete', { checksRun: summary.checks.length, failed: failed.length });
      break;
    }
    case 'vacation': {
      const { processVacationAutoEnd } = await import('@/lib/commerce/vacation-cron');
      const count = await processVacationAutoEnd();
      logger.info('[cronJobs] vacation complete', { vacationsEnded: count });
      break;
    }
    case 'seller-score-recalc': {
      const { processSellerScoreRecalc } = await import('@/lib/jobs/seller-score-recalc');
      await processSellerScoreRecalc();
      logger.info('[cronJobs] seller-score-recalc complete');
      break;
    }
    case 'accounting-sync': {
      const { db } = await import('@twicely/db');
      const { accountingIntegration } = await import('@twicely/db/schema');
      const { eq, and, not, isNull } = await import('drizzle-orm');
      const { runFullSync } = await import('@/lib/accounting/sync-engine');

      const integrations = await db
        .select({ id: accountingIntegration.id })
        .from(accountingIntegration)
        .where(
          and(
            eq(accountingIntegration.status, 'CONNECTED'),
            not(eq(accountingIntegration.syncFrequency, 'MANUAL')),
            not(isNull(accountingIntegration.accessToken)),
          ),
        );

      let synced = 0;
      for (const integration of integrations) {
        try {
          await runFullSync(integration.id);
          synced++;
        } catch (err) {
          logger.error('[cronJobs] accounting-sync failed', { integrationId: integration.id, error: String(err) });
        }
      }
      logger.info('[cronJobs] accounting-sync complete', { synced, total: integrations.length });
      break;
    }
  }
}

export const cronWorker = createWorker<CronJobData>(
  QUEUE_NAME,
  async (job) => { await processCronJob(job.data.task); },
  1,
);
