/**
 * BullMQ cron job for annual 1099 document generation
 * G5.4 — 1099-K document generation
 * G5.5 — Affiliate 1099-NEC generation
 *
 * Runs January 15 annually at midnight UTC.
 * Cron: 0 0 15 1 *
 * Manually triggerable via admin action for testing.
 */

import { createQueue, createWorker } from '@twicely/jobs/queue';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';
import { db } from '@twicely/db';
import { financialReport } from '@twicely/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';


const QUEUE_NAME = 'tax-document-generation';

interface TaxDocumentJobData {
  taxYear: number;
  triggeredAt: string;
  manualTrigger?: boolean;
  targetUserId?: string; // For admin manual trigger of specific seller
}

export const taxDocumentQueue = createQueue<TaxDocumentJobData>(QUEUE_NAME);

/**
 * Register the annual 1099 generation cron job.
 * Call once at app startup.
 */
export async function registerTaxDocumentGenerationJob(): Promise<void> {
  await taxDocumentQueue.add(
    'tax-1099-annual',
    {
      taxYear: new Date().getFullYear() - 1,
      triggeredAt: new Date().toISOString(),
    },
    {
      jobId: 'tax-1099-annual',
      repeat: { pattern: '0 0 15 1 *', tz: 'UTC' }, // January 15, midnight UTC
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

/**
 * Manually trigger 1099 generation for a specific seller.
 * Used by admin on the /fin/tax compliance page.
 */
export async function triggerTaxDocumentForSeller(
  userId: string,
  taxYear: number
): Promise<string> {
  const jobId = `tax-1099k-manual-${userId}-${taxYear}`;
  await taxDocumentQueue.add(
    'tax-1099-manual',
    {
      taxYear,
      triggeredAt: new Date().toISOString(),
      manualTrigger: true,
      targetUserId: userId,
    },
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: { count: 5 },
    }
  );
  return jobId;
}

/**
 * Core logic: generate 1099-K and 1099-NEC documents for a tax year.
 */
export async function processTaxDocumentGeneration(
  taxYear: number,
  targetUserId?: string
): Promise<{ k1099Count: number; nec1099Count: number }> {
  const { generateAll1099KReports, generate1099KData, store1099KReport } =
    await import('@/lib/tax/form-1099k-generator');
  const { generateAll1099NECReports } =
    await import('@/lib/tax/form-1099nec-generator');

  let k1099Count = 0;
  let nec1099Count = 0;

  if (targetUserId) {
    // Single seller manual trigger
    const data = await generate1099KData(targetUserId, taxYear);
    if (data && data.grossAmountCents > 0) {
      await store1099KReport(targetUserId, data);
      k1099Count = 1;
      void notify(targetUserId, 'tax.form_1099k_ready', {
        year: String(taxYear),
      });
    }
  } else {
    // Full annual run
    k1099Count = await generateAll1099KReports(taxYear);
    nec1099Count = await generateAll1099NECReports(taxYear);

    // Notify all sellers who got 1099-K documents
    const generatedReports = await db
      .select({ userId: financialReport.userId })
      .from(financialReport)
      .where(
        and(
          eq(financialReport.reportType, '1099_K'),
          gte(financialReport.periodStart, new Date(Date.UTC(taxYear, 0, 1))),
          lt(financialReport.periodStart, new Date(Date.UTC(taxYear + 1, 0, 1)))
        )
      );

    for (const report of generatedReports) {
      void notify(report.userId, 'tax.form_1099k_ready', { year: String(taxYear) });
    }

    // Notify affiliates who got 1099-NEC documents
    const yearStart = new Date(Date.UTC(taxYear, 0, 1));
    const yearEnd = new Date(Date.UTC(taxYear + 1, 0, 1));

    const necReports = await db
      .select({ userId: financialReport.userId })
      .from(financialReport)
      .where(
        and(
          eq(financialReport.reportType, '1099_NEC'),
          gte(financialReport.periodStart, yearStart),
          lt(financialReport.periodStart, yearEnd)
        )
      );

    for (const report of necReports) {
      void notify(report.userId, 'tax.form_1099nec_ready', { year: String(taxYear) });
    }
  }

  logger.info('[processTaxDocumentGeneration] Complete', {
    taxYear,
    k1099Count,
    nec1099Count,
    targetUserId,
  });

  return { k1099Count, nec1099Count };
}

export const taxDocumentWorker = createWorker<TaxDocumentJobData>(
  QUEUE_NAME,
  async (job) => {
    const { taxYear, targetUserId } = job.data;
    await processTaxDocumentGeneration(taxYear, targetUserId);
  },
  1 // single concurrency
);