import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { financeSubscription, sellerProfile } from '@twicely/db/schema';
import { and, eq, isNull, lt, lte, gte, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';

const QUEUE_NAME = 'expire-finance-pro-trial';
const BATCH_SIZE = 100;

interface ExpireFinanceProTrialJobData {
  triggeredAt: string;
}

/**
 * Queue for the nightly Finance PRO trial expiry job.
 * Runs at 02:00 UTC every night.
 */
export const expireFinanceProTrialQueue = createQueue<ExpireFinanceProTrialJobData>(QUEUE_NAME);

/**
 * Register the repeatable nightly Finance PRO trial expiry job.
 * Call once at app startup.
 */
export async function registerExpireFinanceProTrialJob(): Promise<void> {
  await expireFinanceProTrialQueue.add(
    'expire-finance-pro-trial',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'expire-finance-pro-trial',
      repeat: { pattern: '0 2 * * *', tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

/**
 * Core logic: expire Finance PRO trial subscriptions whose trial period has ended.
 *
 * Criteria: tier = 'PRO' AND stripeSubscriptionId IS NULL AND storeTierTrialEndsAt < now()
 * Action: set tier = 'FREE', update sellerProfile.financeTier = 'FREE', notify user.
 *
 * Processes in batches of 100 until no more rows remain.
 * Idempotent: running twice on same day is safe.
 */
export async function runExpireFinanceProTrial(): Promise<void> {
  const now = new Date();
  let totalExpired = 0;

  while (true) {
    const expired = await db
      .select({
        id: financeSubscription.id,
        sellerProfileId: financeSubscription.sellerProfileId,
      })
      .from(financeSubscription)
      .where(
        and(
          eq(financeSubscription.tier, 'PRO'),
          isNull(financeSubscription.stripeSubscriptionId),
          lt(financeSubscription.storeTierTrialEndsAt, now),
        ),
      )
      .limit(BATCH_SIZE);

    if (expired.length === 0) {
      break;
    }

    let batchExpired = 0;

    for (const row of expired) {
      try {
        // Resolve userId for notification
        const [profile] = await db
          .select({ userId: sellerProfile.userId })
          .from(sellerProfile)
          .where(eq(sellerProfile.id, row.sellerProfileId))
          .limit(1);

        await db
          .update(financeSubscription)
          .set({
            tier: 'FREE',
            updatedAt: sql`now()`,
          })
          .where(eq(financeSubscription.id, row.id));

        await db
          .update(sellerProfile)
          .set({
            financeTier: 'FREE',
            updatedAt: sql`now()`,
          })
          .where(eq(sellerProfile.id, row.sellerProfileId));

        if (profile?.userId) {
          void notify(profile.userId, 'finance.trial.expired', {});
        }

        batchExpired++;
      } catch (err) {
        logger.error('[expireFinanceProTrial] Failed to expire trial', {
          financeSubscriptionId: row.id,
          sellerProfileId: row.sellerProfileId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    totalExpired += batchExpired;

    if (expired.length < BATCH_SIZE) {
      break;
    }
  }

  logger.info(`[expireFinanceProTrial] Expired ${totalExpired} Finance PRO trials`);
}

/**
 * Send 30-day pre-expiry warning notifications.
 *
 * Criteria: tier = 'PRO' AND stripeSubscriptionId IS NULL
 *   AND storeTierTrialEndsAt >= now AND storeTierTrialEndsAt < now + 30 days
 */
export async function runFinanceProTrialExpiryWarnings(): Promise<void> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringSoon = await db
    .select({
      id: financeSubscription.id,
      sellerProfileId: financeSubscription.sellerProfileId,
    })
    .from(financeSubscription)
    .where(
      and(
        eq(financeSubscription.tier, 'PRO'),
        isNull(financeSubscription.stripeSubscriptionId),
        gte(financeSubscription.storeTierTrialEndsAt, now),
        lte(financeSubscription.storeTierTrialEndsAt, thirtyDaysFromNow),
      ),
    )
    .limit(BATCH_SIZE);

  for (const row of expiringSoon) {
    try {
      const [profile] = await db
        .select({ userId: sellerProfile.userId })
        .from(sellerProfile)
        .where(eq(sellerProfile.id, row.sellerProfileId))
        .limit(1);

      if (profile?.userId) {
        void notify(profile.userId, 'finance.trial.expiring_soon', {});
      }
    } catch (err) {
      logger.error('[expireFinanceProTrial] Failed to send expiry warning', {
        financeSubscriptionId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Worker that processes the nightly Finance PRO trial expiry check.
 */
export const expireFinanceProTrialWorker = createWorker<ExpireFinanceProTrialJobData>(
  QUEUE_NAME,
  async () => {
    await runFinanceProTrialExpiryWarnings();
    await runExpireFinanceProTrial();
  },
  1, // single concurrency — avoid duplicate processing
);
