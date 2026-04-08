/**
 * 1099-K data compilation
 * G5.4 — 1099-K document generation + seller download
 *
 * Generates informational 1099-K summary data for sellers.
 * This is NOT an official IRS form — Stripe handles actual filing.
 * taxIdEncrypted is NEVER included in generated data — only taxIdLastFour.
 */

import { db } from '@twicely/db';
import { order, financialReport } from '@twicely/db/schema';
import { taxInfo } from '@twicely/db/schema/tax';
import { and, eq, gte, lt, count, sum } from 'drizzle-orm';
import { getTaxInfoByUserId } from '@/lib/queries/tax-info';
import { logger } from '@twicely/logger';
import { createId } from '@paralleldrive/cuid2';
import { maskTaxId } from '@twicely/db/encryption';

export interface Form1099KData {
  taxYear: number;
  payeeName: string;
  payeeTin: string;          // Last 4 only (masked)
  payeeAddress: string;
  filerName: string;
  filerEin: string;
  grossAmountCents: number;
  transactionCount: number;
  monthlyAmountsCents: number[];   // 12 entries, Jan–Dec
  generatedAt: string;
  disclaimer: string;
}

const DISCLAIMER =
  'This report is provided for informational purposes only and does not constitute tax advice. ' +
  'The official 1099-K is filed electronically by Twicely through Stripe. ' +
  'Consult a qualified tax professional before filing.';

const FILER_NAME = 'Twicely Inc.';
const FILER_EIN = '**-*******'; // Masked — actual EIN stored in environment config

/**
 * Generate 1099-K data for a seller for the given tax year.
 * Includes only COMPLETED orders. Excludes refunded/canceled.
 */
export async function generate1099KData(
  userId: string,
  taxYear: number
): Promise<Form1099KData | null> {
  const taxInfoRow = await getTaxInfoByUserId(userId);
  if (!taxInfoRow) {
    logger.warn('[generate1099KData] No tax info for user', { userId, taxYear });
    return null;
  }

  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear + 1, 0, 1));

  // Total gross amount and transaction count
  const totalsRows = await db
    .select({
      total: sum(order.totalCents),
      txCount: count(order.id),
    })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, yearStart),
        lt(order.completedAt, yearEnd)
      )
    )
    .limit(1);
  const totals = totalsRows[0];

  const grossAmountCents = Number(totals?.total ?? 0);
  const transactionCount = Number(totals?.txCount ?? 0);

  // Monthly breakdown (12 months)
  const monthlyAmountsCents: number[] = Array(12).fill(0);

  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(Date.UTC(taxYear, month, 1));
    const monthEnd = new Date(Date.UTC(taxYear, month + 1, 1));

    const monthRows = await db
      .select({ total: sum(order.totalCents) })
      .from(order)
      .where(
        and(
          eq(order.sellerId, userId),
          eq(order.status, 'COMPLETED'),
          gte(order.completedAt, monthStart),
          lt(order.completedAt, monthEnd)
        )
      )
      .limit(1);
    const monthTotal = monthRows[0];

    monthlyAmountsCents[month] = Number(monthTotal?.total ?? 0);
  }

  const maskedTin =
    taxInfoRow.taxIdLastFour && taxInfoRow.taxIdType
      ? maskTaxId(taxInfoRow.taxIdLastFour, taxInfoRow.taxIdType)
      : '***-**-????';

  const payeeAddress = [
    taxInfoRow.address1,
    taxInfoRow.city,
    taxInfoRow.state,
    taxInfoRow.zip,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    taxYear,
    payeeName: taxInfoRow.legalName ?? taxInfoRow.businessName ?? 'Unknown',
    payeeTin: maskedTin,
    payeeAddress,
    filerName: FILER_NAME,
    filerEin: FILER_EIN,
    grossAmountCents,
    transactionCount,
    monthlyAmountsCents,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Store 1099-K data in the financialReport table.
 * reportType = '1099_K'
 * Retained 7 years per Decision #110.
 */
export async function store1099KReport(
  userId: string,
  data: Form1099KData
): Promise<string> {
  const reportId = createId();
  const periodStart = new Date(Date.UTC(data.taxYear, 0, 1));
  const periodEnd = new Date(Date.UTC(data.taxYear, 11, 31, 23, 59, 59));

  await db.insert(financialReport).values({
    id: reportId,
    userId,
    reportType: '1099_K',
    periodStart,
    periodEnd,
    snapshotJson: JSON.parse(JSON.stringify(data)),
    format: 'JSON',
    fileUrl: `tax-documents/${userId}/${data.taxYear}/1099-K-summary.json`,
  });

  return reportId;
}

/**
 * Generate and store 1099-K for all sellers where form1099Threshold = true
 * for the given tax year.
 */
export async function generateAll1099KReports(taxYear: number): Promise<number> {
  const eligibleSellers = await db
    .select({ userId: taxInfo.userId })
    .from(taxInfo)
    .where(eq(taxInfo.form1099Threshold, true));

  let generated = 0;
  for (const seller of eligibleSellers) {
    try {
      const data = await generate1099KData(seller.userId, taxYear);
      if (data && data.grossAmountCents > 0) {
        await store1099KReport(seller.userId, data);
        generated++;
      }
    } catch (err) {
      logger.error('[generateAll1099KReports] Failed for seller', {
        userId: seller.userId,
        taxYear,
        error: err,
      });
    }
  }

  return generated;
}
