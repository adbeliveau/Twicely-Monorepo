/**
 * Helpers for admin-triggered seller score refresh.
 * Settings loaders, band derivation, enforcement re-eval, band transition notification.
 * Split from seller-score-compute.ts to stay under 300-line limit.
 */

import { db } from '@twicely/db';
import { sellerProfile, sellerScoreSnapshot } from '@twicely/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { notify } from '@twicely/notifications/service';
import type { BandThresholds, CategoryThresholds, MetricWeights, PerformanceBand } from '@twicely/scoring/score-types';

export type { BandThresholds, CategoryThresholds, MetricWeights, PerformanceBand };

const BAND_ORDER: Record<string, number> = {
  EMERGING: 0, ESTABLISHED: 1, TOP_RATED: 2, POWER_SELLER: 3, SUSPENDED: -1,
};

export const BAND_NAMES: Record<PerformanceBand, string> = {
  EMERGING: 'Emerging', ESTABLISHED: 'Established', TOP_RATED: 'Top Rated', POWER_SELLER: 'Power Seller',
};

export async function loadScoreSettings() {
  const [sf, tmm, ps, tr, es, wOts, wInad, wRev, wResp, wRet, wCancel, nst, tst, dgd] =
    await Promise.all([
      getPlatformSetting('score.smoothingFactor', 30),
      getPlatformSetting('score.trendModifierMax', 0.05),
      getPlatformSetting('performance.band.powerSeller', 900),
      getPlatformSetting('performance.band.topRated', 750),
      getPlatformSetting('performance.band.established', 550),
      getPlatformSetting('score.weight.onTimeShipping', 0.25),
      getPlatformSetting('score.weight.inadRate', 0.20),
      getPlatformSetting('score.weight.reviewAverage', 0.20),
      getPlatformSetting('score.weight.responseTime', 0.15),
      getPlatformSetting('score.weight.returnRate', 0.10),
      getPlatformSetting('score.weight.cancellationRate', 0.10),
      getPlatformSetting('score.newSellerOrderThreshold', 10),
      getPlatformSetting('score.transitionOrderThreshold', 50),
      getPlatformSetting('score.downgradeGraceDays', 7),
    ]);
  return {
    smoothingFactor: Number(sf),
    trendModifierMax: Number(tmm),
    bandThresholds: { powerSeller: Number(ps), topRated: Number(tr), established: Number(es) } as BandThresholds,
    weights: {
      onTimeShipping: Number(wOts), inadRate: Number(wInad), reviewAverage: Number(wRev),
      responseTime: Number(wResp), returnRate: Number(wRet), cancellationRate: Number(wCancel),
    } as MetricWeights,
    newSellerThreshold: Number(nst),
    transitionThreshold: Number(tst),
    downgradeGraceDays: Number(dgd),
  };
}

export async function loadCategoryThresholds(fb: string): Promise<CategoryThresholds> {
  const [otsI, otsSt, inadI, inadSt, rtI, rtSt, rrI, rrSt, crI, crSt] = await Promise.all([
    getPlatformSetting(`score.threshold.${fb}.onTimeShipping.ideal`, 0.95),
    getPlatformSetting(`score.threshold.${fb}.onTimeShipping.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.inadRate.ideal`, 0.02),
    getPlatformSetting(`score.threshold.${fb}.inadRate.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.responseTime.ideal`, 8),
    getPlatformSetting(`score.threshold.${fb}.responseTime.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.returnRate.ideal`, 0.03),
    getPlatformSetting(`score.threshold.${fb}.returnRate.steepness`, 10),
    getPlatformSetting(`score.threshold.${fb}.cancellationRate.ideal`, 0.015),
    getPlatformSetting(`score.threshold.${fb}.cancellationRate.steepness`, 10),
  ]);
  return {
    onTimeShipping: { ideal: Number(otsI), steepness: Number(otsSt) },
    inadRate: { ideal: Number(inadI), steepness: Number(inadSt) },
    responseTime: { ideal: Number(rtI), steepness: Number(rtSt) },
    returnRate: { ideal: Number(rrI), steepness: Number(rrSt) },
    cancellationRate: { ideal: Number(crI), steepness: Number(crSt) },
  };
}

export async function loadEnforcementSettings() {
  const [wd, cb, wb, rb, psb] = await Promise.all([
    getPlatformSetting('score.enforcement.warningDurationDays', 30),
    getPlatformSetting('score.enforcement.coachingBelow', 550),
    getPlatformSetting('score.enforcement.warningBelow', 400),
    getPlatformSetting('score.enforcement.restrictionBelow', 250),
    getPlatformSetting('score.enforcement.preSuspensionBelow', 100),
  ]);
  return {
    warningDurationDays: Number(wd), coachingBelow: Number(cb),
    warningBelow: Number(wb), restrictionBelow: Number(rb), preSuspensionBelow: Number(psb),
  };
}

export async function determineEffectiveBand(
  seller: {
    userId: string; performanceBand: string; enforcementLevel: string | null;
    warningExpiresAt: Date | null; bandOverride: string | null; bandOverrideExpiresAt: Date | null;
  },
  scoreDerivedBand: PerformanceBand,
  downgradeGraceDays: number,
): Promise<PerformanceBand> {
  if (seller.bandOverride && seller.bandOverride !== 'SUSPENDED' && seller.bandOverrideExpiresAt) {
    if (seller.bandOverrideExpiresAt > new Date()) {
      return seller.bandOverride as PerformanceBand;
    }
    await db.update(sellerProfile)
      .set({ bandOverride: null, bandOverrideExpiresAt: null, bandOverrideReason: null, bandOverrideBy: null })
      .where(eq(sellerProfile.userId, seller.userId));
  }

  const hasActiveWarning = seller.enforcementLevel === 'WARNING'
    && seller.warningExpiresAt !== null
    && seller.warningExpiresAt > new Date();

  let band = scoreDerivedBand;
  if (hasActiveWarning && (band === 'TOP_RATED' || band === 'POWER_SELLER')) {
    band = 'ESTABLISHED';
  }

  const currentBand = seller.performanceBand;
  if (currentBand === 'SUSPENDED') return band;
  const isDowngrade = BAND_ORDER[band]! < (BAND_ORDER[currentBand] ?? 0);
  if (!isDowngrade) return band;

  const graceCutoff = new Date();
  graceCutoff.setDate(graceCutoff.getDate() - downgradeGraceDays);
  const graceCutoffStr = graceCutoff.toISOString().split('T')[0] as string;

  const recentSnapshots = await db
    .select({ performanceBand: sellerScoreSnapshot.performanceBand })
    .from(sellerScoreSnapshot)
    .where(and(
      eq(sellerScoreSnapshot.userId, seller.userId),
      gte(sellerScoreSnapshot.snapshotDate, graceCutoffStr),
    ))
    .orderBy(desc(sellerScoreSnapshot.snapshotDate))
    .limit(downgradeGraceDays);

  const allBelowCurrent = recentSnapshots.length >= downgradeGraceDays
    && recentSnapshots.every((s) => (BAND_ORDER[s.performanceBand ?? 'EMERGING'] ?? 0) < (BAND_ORDER[currentBand] ?? 0));

  return allBelowCurrent ? band : (currentBand as PerformanceBand);
}

export async function runEnforcementReeval(
  seller: { userId: string; enforcementLevel: string | null },
  score: number,
  warningDurationDays: number,
  coachingBelow: number,
  warningBelow: number,
  restrictionBelow: number,
  preSuspensionBelow: number,
): Promise<void> {
  let newLevel: string | null = null;
  if (score < preSuspensionBelow) newLevel = 'PRE_SUSPENSION';
  else if (score < restrictionBelow) newLevel = 'RESTRICTION';
  else if (score < warningBelow) newLevel = 'WARNING';
  else if (score < coachingBelow) newLevel = 'COACHING';

  const currentLevel = seller.enforcementLevel;
  if (newLevel === currentLevel) return;

  const now = new Date();
  const warningExpiresAt = newLevel === 'WARNING'
    ? new Date(now.getTime() + warningDurationDays * 24 * 60 * 60 * 1000)
    : undefined;

  await db.update(sellerProfile)
    .set({
      enforcementLevel: newLevel,
      enforcementStartedAt: newLevel ? now : null,
      ...(warningExpiresAt ? { warningExpiresAt } : {}),
    })
    .where(eq(sellerProfile.userId, seller.userId));

  const templateMap: Partial<Record<string, 'enforcement.coaching' | 'enforcement.warning' | 'enforcement.restriction'>> = {
    COACHING: 'enforcement.coaching',
    WARNING: 'enforcement.warning',
    RESTRICTION: 'enforcement.restriction',
  };

  if (newLevel && templateMap[newLevel] !== undefined) {
    await notify(seller.userId, templateMap[newLevel]!, { daysToImprove: String(warningDurationDays) });
  } else if (!newLevel && currentLevel) {
    await notify(seller.userId, 'enforcement.lifted', {});
  }
}

export async function notifyBandTransition(
  userId: string,
  previousBand: PerformanceBand,
  newBand: PerformanceBand,
): Promise<void> {
  const isUpgrade = (BAND_ORDER[newBand] ?? 0) > (BAND_ORDER[previousBand] ?? 0);
  if (isUpgrade) {
    await notify(userId, 'enforcement.band_upgrade', { bandName: BAND_NAMES[newBand] });
  } else {
    await notify(userId, 'enforcement.band_downgrade', {
      previousBand: BAND_NAMES[previousBand],
      newBand: BAND_NAMES[newBand],
    });
  }
}
