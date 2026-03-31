/**
 * 1099-NEC data compilation for affiliates
 * G5.5 — Affiliate 1099-NEC generation
 *
 * Generates informational 1099-NEC summary data for affiliates.
 * This is NOT an official IRS form — Stripe handles actual filing.
 * Only PAID commissions counted. taxIdEncrypted never included.
 */

import { db } from '@twicely/db';
import { affiliate, affiliateCommission, financialReport, taxInfo } from '@twicely/db/schema';
import { and, eq, gte, lt, sum } from 'drizzle-orm';
// package equivalent. It needs to be copied into a package (e.g. @twicely/db/queries/tax-info)
// or inlined here.
import { getTaxInfoByUserId } from '@twicely/db/queries/tax-info';
import { maskTaxId } from '@twicely/db/encryption';
import { logger } from '@twicely/logger';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export interface Form1099NECData {
  taxYear: number;
  payeeName: string;
  payeeTin: string;          // Last 4 only (masked)
  payeeAddress: string;
  nonemployeeCompensationCents: number;
  filerName: string;
  filerEin: string;
  generatedAt: string;
  disclaimer: string;
}

const DISCLAIMER =
  'This report is provided for informational purposes only and does not constitute tax advice. ' +
  'The official 1099-NEC is filed electronically by Twicely through Stripe. ' +
  'Consult a qualified tax professional before filing.';

const FILER_NAME = 'Twicely Inc.';
const FILER_EIN = '**-*******';

/**
 * Generate 1099-NEC data for an affiliate for the given tax year.
 * Counts only PAID commissions for the year.
 */
export async function generate1099NECData(
  affiliateId: string,
  taxYear: number
): Promise<Form1099NECData | null> {
  // Get affiliate record to find userId
  const [affRow] = await db
    .select({ userId: affiliate.userId })
    .from(affiliate)
    .where(eq(affiliate.id, affiliateId))
    .limit(1);

  if (!affRow) {
    logger.warn('[generate1099NECData] Affiliate not found', { affiliateId });
    return null;
  }

  const taxInfoRow = await getTaxInfoByUserId(affRow.userId);
  if (!taxInfoRow) {
    logger.warn('[generate1099NECData] No tax info for affiliate', { affiliateId, userId: affRow.userId });
    return null;
  }

  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear + 1, 0, 1));

  const [totals] = await db
    .select({ total: sum(affiliateCommission.commissionCents) })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        eq(affiliateCommission.status, 'PAID'),
        gte(affiliateCommission.paidAt, yearStart),
        lt(affiliateCommission.paidAt, yearEnd)
      )
    );

  const nonemployeeCompensationCents = Number(totals?.total ?? 0);

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
    nonemployeeCompensationCents,
    filerName: FILER_NAME,
    filerEin: FILER_EIN,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Store 1099-NEC data in the financialReport table.
 * reportType = '1099_NEC'
 */
export async function store1099NECReport(
  userId: string,
  data: Form1099NECData
): Promise<string> {
  const reportId = createId();
  const periodStart = new Date(Date.UTC(data.taxYear, 0, 1));
  const periodEnd = new Date(Date.UTC(data.taxYear, 11, 31, 23, 59, 59));

  await db.insert(financialReport).values({
    id: reportId,
    userId,
    reportType: '1099_NEC',
    periodStart,
    periodEnd,
    snapshotJson: JSON.parse(JSON.stringify(data)),
    format: 'JSON',
    fileUrl: `tax-documents/${userId}/${data.taxYear}/1099-NEC-summary.json`,
  });

  return reportId;
}

/**
 * Generate and store 1099-NEC for all affiliates with PAID commissions >= threshold.
 */
export async function generateAll1099NECReports(taxYear: number): Promise<number> {
  const thresholdCents = await getPlatformSetting<number>(
    'tax.1099necThresholdCents',
    60000
  );

  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear + 1, 0, 1));

  // Get all affiliates
  const allAffiliates = await db
    .select({ id: affiliate.id, userId: affiliate.userId })
    .from(affiliate);

  let generated = 0;

  for (const aff of allAffiliates) {
    try {
      const [totals] = await db
        .select({ total: sum(affiliateCommission.commissionCents) })
        .from(affiliateCommission)
        .where(
          and(
            eq(affiliateCommission.affiliateId, aff.id),
            eq(affiliateCommission.status, 'PAID'),
            gte(affiliateCommission.paidAt, yearStart),
            lt(affiliateCommission.paidAt, yearEnd)
          )
        );

      const totalCents = Number(totals?.total ?? 0);
      if (totalCents < thresholdCents) continue;

      // Check tax info exists for this affiliate's user
      const [taxRow] = await db
        .select({ id: taxInfo.id })
        .from(taxInfo)
        .where(eq(taxInfo.userId, aff.userId))
        .limit(1);

      if (!taxRow) continue;

      const data = await generate1099NECData(aff.id, taxYear);
      if (data && data.nonemployeeCompensationCents > 0) {
        await store1099NECReport(aff.userId, data);
        generated++;
      }
    } catch (err) {
      logger.error('[generateAll1099NECReports] Failed for affiliate', {
        affiliateId: aff.id,
        taxYear,
        error: err,
      });
    }
  }

  return generated;
}
