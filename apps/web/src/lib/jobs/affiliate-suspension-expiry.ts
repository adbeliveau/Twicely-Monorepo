/**
 * Auto-unsuspend cron job for time-limited affiliate suspensions.
 *
 * Runs daily at 2 AM UTC. Finds affiliates whose `suspendedUntil` has passed
 * and restores them to ACTIVE status.
 *
 * Per TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL §2.9:
 * "Three strikes policy: first warning, second suspension (30 days), third permanent ban."
 *
 * Permanently banned affiliates have suspendedUntil = NULL and are never auto-restored.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { affiliate, auditEvent } from '@twicely/db/schema';
import { and, eq, lte, isNotNull } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';

const QUEUE_NAME = 'affiliate-suspension-expiry';

interface ExpiryJobData {
  triggeredAt: string;
}

export const affiliateSuspensionQueue = createQueue<ExpiryJobData>(QUEUE_NAME);

/** Register the daily suspension expiry check. Call once at startup. */
export async function registerAffiliateSuspensionExpiryJob(): Promise<void> {
  await affiliateSuspensionQueue.add(
    'affiliate-suspension-expiry',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'affiliate-suspension-expiry',
      repeat: { pattern: '0 2 * * *', tz: 'UTC' }, // Daily at 2 AM UTC
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

/** Process expired suspensions — restore to ACTIVE. */
export async function processExpiredSuspensions(): Promise<number> {
  const now = new Date();

  const expired = await db
    .select({
      id: affiliate.id,
      userId: affiliate.userId,
    })
    .from(affiliate)
    .where(
      and(
        eq(affiliate.status, 'SUSPENDED'),
        isNotNull(affiliate.suspendedUntil),
        lte(affiliate.suspendedUntil, now),
      ),
    );

  if (expired.length === 0) {
    logger.info('[affiliate-suspension-expiry] No expired suspensions');
    return 0;
  }

  for (const aff of expired) {
    await db
      .update(affiliate)
      .set({
        status: 'ACTIVE',
        suspendedAt: null,
        suspendedUntil: null,
        suspendedReason: null,
        updatedAt: now,
      })
      .where(eq(affiliate.id, aff.id));

    await db.insert(auditEvent).values({
      actorType: 'SYSTEM',
      actorId: 'cron:affiliate-suspension-expiry',
      action: 'AFFILIATE_AUTO_UNSUSPENDED',
      subject: 'Affiliate',
      subjectId: aff.id,
      severity: 'MEDIUM',
      detailsJson: { reason: 'Suspension period expired' },
    });

    void notify(aff.userId, 'affiliate.suspension_lifted', {
      reason: 'Your suspension period has ended. Your affiliate account is now active.',
    });
  }

  logger.info('[affiliate-suspension-expiry] Restored affiliates', {
    count: expired.length,
  });

  return expired.length;
}

export const affiliateSuspensionWorker = createWorker<ExpiryJobData>(
  QUEUE_NAME,
  async () => {
    await processExpiredSuspensions();
  },
  1,
);
