import { createQueue, createWorker } from './queue';
import { logger } from '@twicely/logger';
import type { StripeTransferCreator } from './affiliate-payout-service';

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
      repeat: { pattern: '0 6 15 * *' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

/**
 * Core logic: graduate PENDING commissions then execute payouts.
 * Exported for testability.
 */
export async function processAffiliatePayouts(
  createTransfer: StripeTransferCreator
): Promise<void> {
  const { graduateCommissions } = await import('./affiliate-commission-graduation');
  const { executeAffiliatePayouts } = await import('./affiliate-payout-service');

  const graduation = await graduateCommissions();
  logger.info('[affiliatePayoutCron] Graduation complete', {
    graduatedCount: graduation.graduatedCount,
    totalCents: graduation.totalCents,
  });

  const payouts = await executeAffiliatePayouts(createTransfer);
  logger.info('[affiliatePayoutCron] Payouts complete', {
    payoutCount: payouts.payoutCount,
    totalPaidCents: payouts.totalPaidCents,
    failedCount: payouts.failedCount,
  });
}

/**
 * Factory to create the worker for the monthly affiliate payout job.
 * Accepts a StripeTransferCreator callback to avoid circular dep on @twicely/stripe.
 */
export function createAffiliatePayoutWorker(createTransfer: StripeTransferCreator) {
  return createWorker<AffiliatePayoutJobData>(
    QUEUE_NAME,
    async () => {
      await processAffiliatePayouts(createTransfer);
    },
    1 // single concurrency — avoid duplicate processing
  );
}