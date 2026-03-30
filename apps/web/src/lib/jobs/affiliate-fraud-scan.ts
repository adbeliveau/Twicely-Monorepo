/**
 * Affiliate Fraud Scan BullMQ Cron Job (G3.5)
 *
 * Runs every 6 hours. Scans all ACTIVE affiliates with referral
 * activity in the last 24 hours for bot traffic, rapid churn,
 * and geo anomaly patterns. Escalates affiliates with detected signals.
 *
 * Per TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL §2.9.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { affiliate, referral } from '@twicely/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { runAllFraudChecks } from '@/lib/affiliate/fraud-detection';
import { escalateAffiliate } from '@/lib/affiliate/fraud-escalation';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';

const QUEUE_NAME = 'affiliate-fraud-scan';
const SYSTEM_ACTOR_ID = 'SYSTEM';

interface AffiliateFraudScanJobData {
  triggeredAt: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export const affiliateFraudScanQueue = createQueue<AffiliateFraudScanJobData>(QUEUE_NAME);

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Register the repeatable affiliate fraud scan cron job.
 * Call once at app startup from instrumentation.ts.
 */
export async function registerAffiliateFraudScanJob(): Promise<void> {
  await affiliateFraudScanQueue.add(
    'affiliate-fraud-scan',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'affiliate-fraud-scan',
      repeat: { pattern: '0 */6 * * *', tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

// ─── Processing Logic ─────────────────────────────────────────────────────────

export async function processAffiliateFraudScan(): Promise<void> {
  const enabled = await getPlatformSetting<boolean>('affiliate.fraud.enabled', true);
  if (!enabled) {
    logger.info('[affiliate-fraud-scan] Fraud detection disabled, skipping scan');
    return;
  }

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find affiliates with recent referral activity
  const recentAffiliateReferrals = await db
    .select({ affiliateId: referral.affiliateId })
    .from(referral)
    .where(gte(referral.clickedAt, windowStart));

  const recentAffiliateIds = [...new Set(recentAffiliateReferrals.map((r) => r.affiliateId))];

  if (recentAffiliateIds.length === 0) {
    logger.info('[affiliate-fraud-scan] No recent referral activity, skipping');
    return;
  }

  // Only scan ACTIVE affiliates — skip BANNED and SUSPENDED
  const activeAffiliates = await db
    .select({ id: affiliate.id })
    .from(affiliate)
    .where(
      and(
        eq(affiliate.status, 'ACTIVE'),
        inArray(affiliate.id, recentAffiliateIds),
      ),
    );

  logger.info('[affiliate-fraud-scan] Scanning affiliates', { count: activeAffiliates.length });

  let scanned = 0;
  let flagged = 0;

  for (const aff of activeAffiliates) {
    const result = await runAllFraudChecks(aff.id);
    scanned++;

    if (result.highestSeverity === 'NONE') {
      continue;
    }

    flagged++;

    // Escalate on the highest-severity signal
    const topSignal = result.signals.find(
      (s) => s.severity === result.highestSeverity,
    ) ?? result.signals[0];

    if (topSignal) {
      await escalateAffiliate(aff.id, topSignal, SYSTEM_ACTOR_ID);
    }
  }

  logger.info('[affiliate-fraud-scan] Scan complete', { scanned, flagged });
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const affiliateFraudScanWorker = createWorker<AffiliateFraudScanJobData>(
  QUEUE_NAME,
  async () => {
    await processAffiliateFraudScan();
  },
  1,
);