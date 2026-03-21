/**
 * Affiliate tax compliance queries (G5.6)
 * Split from tax-compliance.ts for file size compliance.
 */

import { db } from '@twicely/db';
import { financialReport, affiliate, affiliateCommission } from '@twicely/db/schema';
import { taxInfo } from '@/lib/db/schema/tax';
import { user } from '@/lib/db/schema/auth';
import { and, eq, gte, lt, sum } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { maskTaxId } from '@twicely/db/encryption';
import type { SellerTaxRow } from './tax-compliance';

/**
 * Get list of affiliates over the 1099-NEC threshold.
 */
export async function getAffiliatesNeedingTaxInfo(
  year: number
): Promise<SellerTaxRow[]> {
  const necThresholdCents = await getPlatformSetting<number>(
    'tax.1099necThresholdCents',
    60000
  );

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const affiliateTotals = await db
    .select({
      affiliateId: affiliateCommission.affiliateId,
      total: sum(affiliateCommission.commissionCents),
    })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.status, 'PAID'),
        gte(affiliateCommission.paidAt, yearStart),
        lt(affiliateCommission.paidAt, yearEnd)
      )
    )
    .groupBy(affiliateCommission.affiliateId);

  const overThreshold = affiliateTotals.filter(
    (r) => Number(r.total ?? 0) >= necThresholdCents
  );

  const results: SellerTaxRow[] = [];

  for (const row of overThreshold) {
    const [affRow] = await db
      .select({ userId: affiliate.userId })
      .from(affiliate)
      .where(eq(affiliate.id, row.affiliateId))
      .limit(1);

    if (!affRow) continue;

    const [userRow] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, affRow.userId))
      .limit(1);

    if (!userRow) continue;

    const [taxRow] = await db
      .select({ taxIdLastFour: taxInfo.taxIdLastFour, taxIdType: taxInfo.taxIdType })
      .from(taxInfo)
      .where(eq(taxInfo.userId, affRow.userId))
      .limit(1);

    const maskedTaxId =
      taxRow?.taxIdLastFour && taxRow.taxIdType
        ? maskTaxId(taxRow.taxIdLastFour, taxRow.taxIdType)
        : null;

    const [docRow] = await db
      .select({ id: financialReport.id })
      .from(financialReport)
      .where(
        and(
          eq(financialReport.userId, affRow.userId),
          eq(financialReport.reportType, '1099_NEC'),
          gte(financialReport.periodStart, yearStart),
          lt(financialReport.periodStart, yearEnd)
        )
      )
      .limit(1);

    results.push({
      userId: affRow.userId,
      email: userRow.email,
      ytdGrossCents: Number(row.total ?? 0),
      taxInfoProvided: taxRow !== undefined,
      maskedTaxId,
      doc1099KGenerated: docRow !== undefined,
    });
  }

  return results;
}
