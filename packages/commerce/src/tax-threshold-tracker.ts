/**
 * Tax threshold tracking service
 * G5.3 — 1099-K threshold tracking + payout gating
 *
 * Tracks seller YTD gross sales for IRS 1099-K reporting.
 * Uses GROSS sales (totalCents) per IRS requirements — not net.
 * Calendar year basis (Jan 1 – Dec 31).
 */

import { db } from '@twicely/db';
import { order, taxInfo } from '@twicely/db/schema';
import { and, eq, gte, lt, sum } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';

export interface ThresholdStatus {
  ytdGrossCents: number;
  thresholdCents: number;
  earlyWarningCents: number;
  needsTaxInfo: boolean;
  taxInfoProvided: boolean;
  isOverThreshold: boolean;
  isOverEarlyWarning: boolean;
}

/**
 * Get seller's YTD gross sales for a calendar year.
 * Counts COMPLETED orders only. Excludes refunded/canceled.
 * Uses totalCents (gross) per IRS 1099-K requirements.
 */
export async function getSellerYtdGrossSales(
  userId: string,
  year: number
): Promise<number> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const results = await db
    .select({ total: sum(order.totalCents) })
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

  const result = results[0];
  return Number(result?.total ?? 0);
}

/**
 * Check a seller's threshold status for the current calendar year.
 */
export async function checkThresholdStatus(
  userId: string
): Promise<ThresholdStatus> {
  const currentYear = new Date().getFullYear();

  const [ytdGrossCents, thresholdCents, earlyWarningCents] = await Promise.all([
    getSellerYtdGrossSales(userId, currentYear),
    getPlatformSetting<number>('tax.1099kThresholdCents', 60000),
    getPlatformSetting<number>('tax.earlyWarningThresholdCents', 50000),
  ]);

  const [taxInfoRow] = await db
    .select({ id: taxInfo.id, form1099Threshold: taxInfo.form1099Threshold })
    .from(taxInfo)
    .where(eq(taxInfo.userId, userId))
    .limit(1);

  const taxInfoProvided = taxInfoRow !== undefined;
  const isOverThreshold = ytdGrossCents >= thresholdCents;
  const isOverEarlyWarning = ytdGrossCents >= earlyWarningCents;
  const needsTaxInfo = isOverThreshold && !taxInfoProvided;

  return {
    ytdGrossCents,
    thresholdCents,
    earlyWarningCents,
    needsTaxInfo,
    taxInfoProvided,
    isOverThreshold,
    isOverEarlyWarning,
  };
}

/**
 * Update threshold flag after an order completion.
 * Sets taxInfo.form1099Threshold = true when seller crosses the 1099-K threshold.
 * Called fire-and-forget after order completion — does NOT block order.
 */
export async function updateThresholdFlag(userId: string): Promise<void> {
  try {
    const status = await checkThresholdStatus(userId);

    if (status.isOverThreshold && !status.taxInfoProvided) {
      await db
        .update(taxInfo)
        .set({ form1099Threshold: true, updatedAt: new Date() })
        .where(eq(taxInfo.userId, userId));

      void notify(userId, 'tax.info_required', {
        thresholdFormatted: `$${(status.thresholdCents / 100).toFixed(2)}`,
      });
    } else if (status.isOverThreshold) {
      await db
        .update(taxInfo)
        .set({ form1099Threshold: true, updatedAt: new Date() })
        .where(eq(taxInfo.userId, userId));
    } else if (status.isOverEarlyWarning && !status.taxInfoProvided) {
      void notify(userId, 'tax.info_required', {
        thresholdFormatted: `$${(status.thresholdCents / 100).toFixed(2)}`,
      });
    }
  } catch (err) {
    logger.error('[updateThresholdFlag] Failed to update threshold flag', {
      userId,
      error: err,
    });
  }
}
