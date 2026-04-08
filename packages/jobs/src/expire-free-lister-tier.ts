import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'expire-free-lister-tier';
const BATCH_SIZE = 100;

interface ExpireFreeListerJobData {
  triggeredAt: string;
}

/**
 * Queue for the nightly FREE ListerTier expiry job.
 * Runs at 02:00 UTC every night.
 */
export const expireFreeListerQueue = createQueue<ExpireFreeListerJobData>(QUEUE_NAME);

/**
 * Register the repeatable nightly expiry job.
 * Call once at app startup.
 */
export async function registerExpireFreeListerJob(): Promise<void> {
  await expireFreeListerQueue.add(
    'expire-free-lister-tier',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'expire-free-lister-tier',
      repeat: { pattern: '0 2 * * *', tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

/**
 * Core logic: downgrade sellers whose FREE ListerTier teaser has expired.
 *
 * Criteria: listerTier = 'FREE' AND listerFreeExpiresAt IS NOT NULL AND listerFreeExpiresAt < now()
 * Action: set listerTier = 'NONE', listerFreeExpiresAt = NULL
 *
 * Does NOT delist any projections. Does NOT cancel any Stripe subscription.
 * Seller retains all existing projections — they just can't create new publishes.
 *
 * Processes in batches of 100 until no more rows remain.
 * Idempotent: running twice on same day is safe.
 */
export async function runExpireFreeListerTier(): Promise<void> {
  const now = new Date();
  let totalDowngraded = 0;

  while (true) {
    const expired = await db
      .select({ userId: sellerProfile.userId })
      .from(sellerProfile)
      .where(
        and(
          eq(sellerProfile.listerTier, 'FREE'),
          isNotNull(sellerProfile.listerFreeExpiresAt),
          lt(sellerProfile.listerFreeExpiresAt, now)
        )
      )
      .limit(BATCH_SIZE);

    if (expired.length === 0) {
      break;
    }

    let batchDowngraded = 0;

    for (const row of expired) {
      try {
        await db
          .update(sellerProfile)
          .set({
            listerTier: 'NONE',
            listerFreeExpiresAt: null,
            updatedAt: sql`now()`,
          })
          .where(eq(sellerProfile.userId, row.userId));

        batchDowngraded++;
      } catch (err) {
        logger.error('[expireFreeListerTier] Failed to downgrade seller', {
          userId: row.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    totalDowngraded += batchDowngraded;

    // If we got fewer rows than BATCH_SIZE, there are no more rows to process
    if (expired.length < BATCH_SIZE) {
      break;
    }
  }

  logger.info(`[expireFreeListerTier] Downgraded ${totalDowngraded} sellers`);
}

/**
 * Worker that processes the nightly FREE ListerTier expiry check.
 */
export const expireFreeListerWorker = createWorker<ExpireFreeListerJobData>(
  QUEUE_NAME,
  async () => {
    await runExpireFreeListerTier();
  },
  1 // single concurrency — avoid duplicate processing
);
