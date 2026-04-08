/**
 * Monthly boost credit issuance BullMQ job.
 * Seller Score Canonical §5.4 — runs at 06:00 UTC on the 1st of each month.
 *
 * Issues boost credit to POWER_SELLER ($15) and TOP_RATED ($10) sellers.
 * Idempotent: skips sellers who already received credit for the current period month.
 */

import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { sellerProfile, ledgerEntry } from '@twicely/db/schema';
import { eq, and, inArray, gte, lt } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { TemplateKey } from '@twicely/notifications/templates-types';

const QUEUE_NAME = 'monthly-boost-credit';

interface BoostCreditJobData {
  triggeredAt: string;
}

export const monthlyBoostCreditQueue = createQueue<BoostCreditJobData>(QUEUE_NAME);

export async function registerMonthlyBoostCreditJob(): Promise<void> {
  const pattern = await getPlatformSetting('jobs.cron.monthlyBoostCredit.pattern', '0 6 1 * *');
  await monthlyBoostCreditQueue.add(
    'monthly-boost-credit',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'monthly-boost-credit',
      repeat: { pattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
  logger.info('[monthlyBoostCredit] Registered monthly boost credit job');
}

interface BoostCreditResult {
  processed: number;
  totalCents: number;
  skipped: number;
  errors: number;
}

export async function processMonthlyBoostCredit(
  notifyFn: (userId: string, key: TemplateKey, data: Record<string, string>) => Promise<void>,
): Promise<BoostCreditResult> {
  const [powerSellerCreditCents, topRatedCreditCents, batchSize] = await Promise.all([
    getPlatformSetting('score.rewards.powerSellerMonthlyCreditCents', 1500),
    getPlatformSetting('score.rewards.topRatedMonthlyCreditCents', 1000),
    getPlatformSetting('score.rewards.batchSize', 500),
  ]);

  const now = new Date();
  const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  // Start of this calendar month (UTC) for idempotency check
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const result: BoostCreditResult = { processed: 0, totalCents: 0, skipped: 0, errors: 0 };

  let offset = 0;
  const limit = Number(batchSize);

  while (true) {
    const sellers = await db
      .select({
        userId: sellerProfile.userId,
        performanceBand: sellerProfile.performanceBand,
        boostCreditCents: sellerProfile.boostCreditCents,
      })
      .from(sellerProfile)
      .where(
        and(
          eq(sellerProfile.status, 'ACTIVE'),
          inArray(sellerProfile.performanceBand, ['POWER_SELLER', 'TOP_RATED']),
        ),
      )
      .limit(limit)
      .offset(offset);

    if (sellers.length === 0) break;

    for (const seller of sellers) {
      try {
        const creditAmount =
          seller.performanceBand === 'POWER_SELLER'
            ? Number(powerSellerCreditCents)
            : Number(topRatedCreditCents);

        // Idempotency: check for existing BOOST_CREDIT_ISSUED entry this period month
        const existing = await db
          .select({ id: ledgerEntry.id })
          .from(ledgerEntry)
          .where(
            and(
              eq(ledgerEntry.type, 'BOOST_CREDIT_ISSUED'),
              eq(ledgerEntry.userId, seller.userId),
              gte(ledgerEntry.createdAt, periodStart),
              lt(ledgerEntry.createdAt, periodEnd),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          result.skipped++;
          continue;
        }

        await db.transaction(async (tx) => {
          // Insert ledger entry (positive = credit to seller)
          await tx.insert(ledgerEntry).values({
            id: createId(),
            type: 'BOOST_CREDIT_ISSUED',
            status: 'POSTED',
            amountCents: creditAmount,
            userId: seller.userId,
            memo: `Performance reward — ${seller.performanceBand} — ${periodMonth}`,
            postedAt: now,
          });

          // Update sellerProfile.boostCreditCents
          await tx
            .update(sellerProfile)
            .set({ boostCreditCents: seller.boostCreditCents + creditAmount })
            .where(eq(sellerProfile.userId, seller.userId));
        });

        // Notify seller
        await notifyFn(seller.userId, 'seller.boostCredit.issued', {
          amountCents: String(creditAmount),
          band: seller.performanceBand ?? '',
          periodMonth,
          amountFormatted: `$${(creditAmount / 100).toFixed(2)}`,
          periodMonthFormatted: new Date(`${periodMonth}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          bandLabel: seller.performanceBand === 'POWER_SELLER' ? 'Power Seller' : 'Top Seller',
        });

        result.processed++;
        result.totalCents += creditAmount;
      } catch (err) {
        logger.error('[monthlyBoostCredit] Error processing seller', {
          userId: seller.userId,
          err,
        });
        result.errors++;
      }
    }

    if (sellers.length < limit) break;
    offset += limit;
  }

  logger.info('[monthlyBoostCredit] Complete', {
    periodMonth,
    processed: result.processed,
    totalCents: result.totalCents,
    skipped: result.skipped,
    errors: result.errors,
  });

  return result;
}

export function createMonthlyBoostCreditWorker(
  notifyFn: (userId: string, key: TemplateKey, data: Record<string, string>) => Promise<void>,
) {
  return createWorker<BoostCreditJobData>(
    QUEUE_NAME,
    async () => {
      await processMonthlyBoostCredit(notifyFn);
    },
    1, // single concurrency — avoid duplicate processing
  );
}

// ─── Auto-instantiated worker ────────────────────────────────────────────────
// Dynamic import of @twicely/notifications to avoid circular dep at compile time.

void (async () => {
  const { notify } = await import('@twicely/notifications/service');
  createMonthlyBoostCreditWorker(notify);
})();
