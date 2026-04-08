/**
 * Query functions for the seller performance dashboard page.
 * Seller Score Canonical Section 7.
 */

import { db } from '@twicely/db';
import { sellerProfile, sellerScoreSnapshot, sellerPerformance } from '@twicely/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { PerformanceBand, TrendState } from '@twicely/scoring/score-types';
import { calculateTrend } from '@twicely/scoring/calculate-seller-score';

export interface SellerScoreData {
  sellerScore: number;
  isNew: boolean;
  performanceBand: PerformanceBand;
  sellerScoreUpdatedAt: Date | null;
  enforcementLevel: string | null;
  boostCreditCents: number;
  completedOrders: number;
  averageRating: number | null;
}

export interface ScoreHistoryPoint {
  date: string;
  score: number;
  band: PerformanceBand;
}

export interface MetricBreakdownItem {
  key: string;
  label: string;
  value: number;
  score: number;
  ideal: number;
  weight: number;
  tips: string[];
}

export interface MetricBreakdown {
  metrics: MetricBreakdownItem[];
}

/**
 * Returns sellerProfile score fields + sellerPerformance aggregate + latest snapshot.
 */
export async function getSellerScoreData(userId: string): Promise<SellerScoreData | null> {
  const [profileRow] = await db
    .select({
      sellerScore: sellerProfile.sellerScore,
      isNew: sellerProfile.isNew,
      performanceBand: sellerProfile.performanceBand,
      sellerScoreUpdatedAt: sellerProfile.sellerScoreUpdatedAt,
      enforcementLevel: sellerProfile.enforcementLevel,
      boostCreditCents: sellerProfile.boostCreditCents,
      sellerProfileId: sellerProfile.id,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profileRow) return null;

  const [perfRow] = await db
    .select({ completedOrders: sellerPerformance.completedOrders, averageRating: sellerPerformance.averageRating })
    .from(sellerPerformance)
    .where(eq(sellerPerformance.sellerProfileId, profileRow.sellerProfileId))
    .limit(1);

  return {
    sellerScore: profileRow.sellerScore,
    isNew: profileRow.isNew,
    performanceBand: profileRow.performanceBand as PerformanceBand,
    sellerScoreUpdatedAt: profileRow.sellerScoreUpdatedAt,
    enforcementLevel: profileRow.enforcementLevel,
    boostCreditCents: profileRow.boostCreditCents,
    completedOrders: perfRow?.completedOrders ?? 0,
    averageRating: perfRow?.averageRating ?? null,
  };
}

/**
 * Returns array of daily snapshots for the score chart.
 */
export async function getScoreHistory(userId: string, days: number): Promise<ScoreHistoryPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0] as string;

  const rows = await db
    .select({
      snapshotDate: sellerScoreSnapshot.snapshotDate,
      overallScore: sellerScoreSnapshot.overallScore,
      performanceBand: sellerScoreSnapshot.performanceBand,
    })
    .from(sellerScoreSnapshot)
    .where(and(
      eq(sellerScoreSnapshot.userId, userId),
      gte(sellerScoreSnapshot.snapshotDate, sinceStr),
    ))
    .orderBy(desc(sellerScoreSnapshot.snapshotDate))
    .limit(days);

  return rows
    .filter((r) => r.snapshotDate !== null)
    .map((r) => ({
      date: r.snapshotDate as string,
      score: Math.round(r.overallScore),
      band: r.performanceBand as PerformanceBand,
    }))
    .reverse();
}

/**
 * Returns per-metric values, scores, thresholds, and coaching tips.
 */
export async function getMetricBreakdown(userId: string): Promise<MetricBreakdown> {
  const [snapshot] = await db
    .select({
      onTimeShippingPct: sellerScoreSnapshot.onTimeShippingPct,
      inadClaimRatePct: sellerScoreSnapshot.inadClaimRatePct,
      reviewAverage: sellerScoreSnapshot.reviewAverage,
      responseTimeHours: sellerScoreSnapshot.responseTimeHours,
      returnRatePct: sellerScoreSnapshot.returnRatePct,
      cancellationRatePct: sellerScoreSnapshot.cancellationRatePct,
      shippingScore: sellerScoreSnapshot.shippingScore,
      inadScore: sellerScoreSnapshot.inadScore,
      reviewScore: sellerScoreSnapshot.reviewScore,
      responseScore: sellerScoreSnapshot.responseScore,
      returnScore: sellerScoreSnapshot.returnScore,
      cancellationScore: sellerScoreSnapshot.cancellationScore,
      primaryFeeBucket: sellerScoreSnapshot.primaryFeeBucket,
    })
    .from(sellerScoreSnapshot)
    .where(eq(sellerScoreSnapshot.userId, userId))
    .orderBy(desc(sellerScoreSnapshot.snapshotDate))
    .limit(1);

  const fb = snapshot?.primaryFeeBucket ?? 'APPAREL_ACCESSORIES';

  const [tipOts, tipInad, tipRt, tipRr, tipCr,
    wOts, wInad, wRev, wResp, wRet, wCancel,
    otsIdeal, inadIdeal, rtIdeal, rrIdeal, crIdeal,
  ] = await Promise.all([
    getPlatformSetting<string[]>('score.tips.onTimeShipping', []),
    getPlatformSetting<string[]>('score.tips.inadRate', []),
    getPlatformSetting<string[]>('score.tips.responseTime', []),
    getPlatformSetting<string[]>('score.tips.returnRate', []),
    getPlatformSetting<string[]>('score.tips.cancellationRate', []),
    getPlatformSetting('score.weight.onTimeShipping', 0.25),
    getPlatformSetting('score.weight.inadRate', 0.20),
    getPlatformSetting('score.weight.reviewAverage', 0.20),
    getPlatformSetting('score.weight.responseTime', 0.15),
    getPlatformSetting('score.weight.returnRate', 0.10),
    getPlatformSetting('score.weight.cancellationRate', 0.10),
    getPlatformSetting(`score.threshold.${fb}.onTimeShipping.ideal`, 0.95),
    getPlatformSetting(`score.threshold.${fb}.inadRate.ideal`, 0.02),
    getPlatformSetting(`score.threshold.${fb}.responseTime.ideal`, 8),
    getPlatformSetting(`score.threshold.${fb}.returnRate.ideal`, 0.03),
    getPlatformSetting(`score.threshold.${fb}.cancellationRate.ideal`, 0.015),
  ]);

  const metrics: MetricBreakdownItem[] = [
    { key: 'onTimeShipping', label: 'On-Time Shipping', value: snapshot?.onTimeShippingPct ?? 0, score: snapshot?.shippingScore ?? 0, ideal: Number(otsIdeal), weight: Number(wOts), tips: tipOts as string[] },
    { key: 'inadRate', label: 'Item Not as Described Rate', value: snapshot?.inadClaimRatePct ?? 0, score: snapshot?.inadScore ?? 0, ideal: Number(inadIdeal), weight: Number(wInad), tips: tipInad as string[] },
    { key: 'reviewAverage', label: 'Review Average', value: snapshot?.reviewAverage ?? 0, score: snapshot?.reviewScore ?? 0, ideal: 4.5, weight: Number(wRev), tips: [] },
    { key: 'responseTime', label: 'Response Time (hrs)', value: snapshot?.responseTimeHours ?? 0, score: snapshot?.responseScore ?? 0, ideal: Number(rtIdeal), weight: Number(wResp), tips: tipRt as string[] },
    { key: 'returnRate', label: 'Return Rate', value: snapshot?.returnRatePct ?? 0, score: snapshot?.returnScore ?? 0, ideal: Number(rrIdeal), weight: Number(wRet), tips: tipRr as string[] },
    { key: 'cancellationRate', label: 'Cancellation Rate', value: snapshot?.cancellationRatePct ?? 0, score: snapshot?.cancellationScore ?? 0, ideal: Number(crIdeal), weight: Number(wCancel), tips: tipCr as string[] },
  ];

  return { metrics };
}

/**
 * Calculate trend state for a seller from snapshot history.
 */
export async function getSellerTrend(userId: string): Promise<TrendState> {
  const history = await getScoreHistory(userId, 90);
  return calculateTrend(history.map((h) => h.score));
}
