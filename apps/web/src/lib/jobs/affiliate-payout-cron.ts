import { createQueue, createWorker } from '@twicely/jobs/queue';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'affiliate-payout';

interface AffiliatePayoutJobData {
  triggeredAt: string;
}

/**
 * Queue for the monthly affiliate payout job.
 * Runs at 06:00 UTC on the 15th of each month.
 */
export const affiliatePayoutQueue = createQueue<AffiliatePayoutJobData>(QUEUE_NAME);

/**
 * Register the repeatable monthly affiliate payout job.
 * Call once at app startup.
 */
export async function registerAffiliatePayoutJob(): Promise<void> {
  await affiliatePayoutQueue.add(
    'affiliate-payout-monthly',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'affiliate-payout-monthly',
      repeat: { pattern: '0 6 15 * *', tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

/**
 * Core logic: graduate PENDING commissions then execute payouts.
 * Exported for testability.
 */
export async function processAffiliatePayouts(): Promise<void> {
  const { graduateCommissions } = await import('@/lib/affiliate/commission-graduation');
  const { executeAffiliatePayouts } = await import('@/lib/affiliate/affiliate-payout-service');

  const graduation = await graduateCommissions();
  logger.info('[affiliatePayoutCron] Graduation complete', {
    graduatedCount: graduation.graduatedCount,
    totalCents: graduation.totalCents,
  });

  const payouts = await executeAffiliatePayouts();
  logger.info('[affiliatePayoutCron] Payouts complete', {
    payoutCount: payouts.payoutCount,
    totalPaidCents: payouts.totalPaidCents,
    failedCount: payouts.failedCount,
  });
}

/**
 * Worker that processes the monthly affiliate payout job.
 */
export const affiliatePayoutWorker = createWorker<AffiliatePayoutJobData>(
  QUEUE_NAME,
  async () => {
    await processAffiliatePayouts();
  },
  1 // single concurrency — avoid duplicate processing
);