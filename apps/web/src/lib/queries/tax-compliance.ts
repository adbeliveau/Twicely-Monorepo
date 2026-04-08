/**
 * Admin tax compliance queries
 * G5.6 — Admin tax compliance hub page
 *
 * All queries use calendar year basis.
 * Tax IDs shown MASKED (last 4 only) — full SSN never displayed.
 */

import { db } from '@twicely/db';
import { order, financialReport, affiliateCommission } from '@twicely/db/schema';
import { taxInfo } from '@twicely/db/schema/tax';
import { user } from '@twicely/db/schema/auth';
import { and, count, eq, gte, lt, sum } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { maskTaxId } from '@twicely/db/encryption';

export interface TaxComplianceSummary {
  year: number;
  sellersApproachingThreshold: number;
  sellersOverThreshold: number;
  sellersWithTaxInfo: number;
  sellersMissingTaxInfo: number;
  docs1099KGenerated: number;
  affiliatesOverNecThreshold: number;
}

export interface SellerTaxRow {
  userId: string;
  email: string;
  ytdGrossCents: number;
  taxInfoProvided: boolean;
  maskedTaxId: string | null;
  doc1099KGenerated: boolean;
}

/**
 * Aggregate tax compliance stats for admin dashboard.
 */
export async function getTaxComplianceSummary(
  year: number
): Promise<TaxComplianceSummary> {
  const [thresholdCents, earlyWarningCents, necThresholdCents] = await Promise.all([
    getPlatformSetting<number>('tax.1099kThresholdCents', 60000),
    getPlatformSetting<number>('tax.earlyWarningThresholdCents', 50000),
    getPlatformSetting<number>('tax.1099necThresholdCents', 60000),
  ]);

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  // Count sellers with tax info
  const taxInfoRows = await db
    .select({ cnt: count(taxInfo.id) })
    .from(taxInfo)
    .limit(1);
  const taxInfoCount = taxInfoRows[0];
  const sellersWithTaxInfo = Number(taxInfoCount?.cnt ?? 0);

  // Count 1099-K docs generated for this year
  const docsRows = await db
    .select({ cnt: count(financialReport.id) })
    .from(financialReport)
    .where(
      and(
        eq(financialReport.reportType, '1099_K'),
        gte(financialReport.periodStart, yearStart),
        lt(financialReport.periodStart, yearEnd)
      )
    )
    .limit(1);
  const docsCount = docsRows[0];
  const docs1099KGenerated = Number(docsCount?.cnt ?? 0);

  // Get per-seller YTD sums to compute threshold counts
  const sellerTotals = await db
    .select({
      sellerId: order.sellerId,
      total: sum(order.totalCents),
    })
    .from(order)
    .where(
      and(
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, yearStart),
        lt(order.completedAt, yearEnd)
      )
    )
    .groupBy(order.sellerId);

  let sellersApproachingThreshold = 0;
  let sellersOverThreshold = 0;
  const overThresholdSellerIds: string[] = [];

  for (const row of sellerTotals) {
    const total = Number(row.total ?? 0);
    if (total >= thresholdCents) {
      sellersOverThreshold++;
      overThresholdSellerIds.push(row.sellerId);
    } else if (total >= earlyWarningCents) {
      sellersApproachingThreshold++;
    }
  }

  // Count over-threshold sellers who have NOT provided tax info
  let sellersMissingTaxInfo = 0;
  for (const sid of overThresholdSellerIds) {
    const [taxRow] = await db
      .select({ id: taxInfo.id })
      .from(taxInfo)
      .where(eq(taxInfo.userId, sid))
      .limit(1);
    if (!taxRow) sellersMissingTaxInfo++;
  }

  // Count affiliates over 1099-NEC threshold
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

  const affiliatesOverNecThreshold = affiliateTotals.filter(
    (r) => Number(r.total ?? 0) >= necThresholdCents
  ).length;

  return {
    year,
    sellersApproachingThreshold,
    sellersOverThreshold,
    sellersWithTaxInfo,
    sellersMissingTaxInfo,
    docs1099KGenerated,
    affiliatesOverNecThreshold,
  };
}

/**
 * Get list of sellers over the 1099-K threshold with their tax info status.
 */
export async function getSellersNeedingTaxInfo(
  year: number
): Promise<SellerTaxRow[]> {
  const thresholdCents = await getPlatformSetting<number>('tax.1099kThresholdCents', 60000);

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const sellerTotals = await db
    .select({
      sellerId: order.sellerId,
      total: sum(order.totalCents),
    })
    .from(order)
    .where(
      and(
        eq(order.status, 'COMPLETED'),
        gte(order.completedAt, yearStart),
        lt(order.completedAt, yearEnd)
      )
    )
    .groupBy(order.sellerId);

  const overThreshold = sellerTotals.filter(
    (r) => Number(r.total ?? 0) >= thresholdCents
  );

  const results: SellerTaxRow[] = [];

  for (const row of overThreshold) {
    const [userRow] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, row.sellerId))
      .limit(1);

    if (!userRow) continue;

    const [taxRow] = await db
      .select({
        id: taxInfo.id,
        taxIdLastFour: taxInfo.taxIdLastFour,
        taxIdType: taxInfo.taxIdType,
      })
      .from(taxInfo)
      .where(eq(taxInfo.userId, row.sellerId))
      .limit(1);

    const [docRow] = await db
      .select({ id: financialReport.id })
      .from(financialReport)
      .where(
        and(
          eq(financialReport.userId, row.sellerId),
          eq(financialReport.reportType, '1099_K'),
          gte(financialReport.periodStart, yearStart),
          lt(financialReport.periodStart, yearEnd)
        )
      )
      .limit(1);

    const maskedTaxId =
      taxRow?.taxIdLastFour && taxRow.taxIdType
        ? maskTaxId(taxRow.taxIdLastFour, taxRow.taxIdType)
        : null;

    results.push({
      userId: row.sellerId,
      email: userRow.email,
      ytdGrossCents: Number(row.total ?? 0),
      taxInfoProvided: taxRow !== undefined,
      maskedTaxId,
      doc1099KGenerated: docRow !== undefined,
    });
  }

  return results;
}

// Affiliate query split to tax-compliance-affiliates.ts for file size compliance
export { getAffiliatesNeedingTaxInfo } from './tax-compliance-affiliates';
