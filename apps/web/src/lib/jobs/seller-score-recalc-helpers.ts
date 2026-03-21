/**
 * Helpers for seller score recalculation: band derivation, auto-enforcement, notifications.
 * Split from seller-score-recalc.ts to stay under 300-line limit.
 */

import { db } from '@twicely/db';
import { sellerProfile, sellerScoreSnapshot, enforcementAction } from '@twicely/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { notify } from '@twicely/notifications/service';
import type { PerformanceBand } from '@/lib/scoring/score-types';

type BandWithSuspended = PerformanceBand | 'SUSPENDED';

const BAND_ORDER: Record<BandWithSuspended, number> = {
  EMERGING: 0, ESTABLISHED: 1, TOP_RATED: 2, POWER_SELLER: 3, SUSPENDED: -1,
};

const BAND_NAMES: Record<PerformanceBand, string> = {
  EMERGING: 'Emerging', ESTABLISHED: 'Established', TOP_RATED: 'Top Rated', POWER_SELLER: 'Power Seller',
};

export interface SellerRow {
  id: string;
  userId: string;
  status: string;
  performanceBand: BandWithSuspended;
  enforcementLevel: string | null;
  warningExpiresAt: Date | null;
  bandOverride: BandWithSuspended | null;
  bandOverrideExpiresAt: Date | null;
  sellerScore: number;
}

export async function determineEffectiveBand(
  seller: SellerRow,
  scoreDerivedBand: PerformanceBand,
  downgradeGraceDays: number,
): Promise<PerformanceBand> {
  // Band override takes precedence (only PerformanceBand overrides, not SUSPENDED)
  if (seller.bandOverride && seller.bandOverride !== 'SUSPENDED' && seller.bandOverrideExpiresAt) {
    if (seller.bandOverrideExpiresAt > new Date()) {
      return seller.bandOverride as PerformanceBand;
    }
    await db.update(sellerProfile)
      .set({ bandOverride: null, bandOverrideExpiresAt: null, bandOverrideReason: null, bandOverrideBy: null })
      .where(eq(sellerProfile.userId, seller.userId));
  }

  // Warning lockout: active warning prevents TOP_RATED/POWER_SELLER
  const hasActiveWarning = seller.enforcementLevel === 'WARNING'
    && seller.warningExpiresAt !== null
    && seller.warningExpiresAt > new Date();

  let band = scoreDerivedBand;
  if (hasActiveWarning && (band === 'TOP_RATED' || band === 'POWER_SELLER')) {
    band = 'ESTABLISHED';
  }

  // Downgrade grace period check — only applies to non-SUSPENDED bands
  const currentBand = seller.performanceBand;
  if (currentBand === 'SUSPENDED') return band; // Can't downgrade from SUSPENDED via scoring
  const isDowngrade = BAND_ORDER[band] < BAND_ORDER[currentBand];
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
    && recentSnapshots.every((s) => BAND_ORDER[s.performanceBand ?? 'EMERGING'] < BAND_ORDER[currentBand]);

  return allBelowCurrent ? band : (currentBand as PerformanceBand);
}

export async function runAutoEnforcement(
  seller: SellerRow,
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

  if (newLevel) {
    await db.insert(enforcementAction).values({
      id: createId(),
      userId: seller.userId,
      actionType: newLevel as 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION',
      trigger: 'SCORE_BASED',
      status: 'ACTIVE',
      reason: `Seller score ${score} triggered ${newLevel}`,
      details: { score, previousLevel: currentLevel },
    });
  }

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
  const isUpgrade = BAND_ORDER[newBand] > BAND_ORDER[previousBand];
  if (isUpgrade) {
    await notify(userId, 'enforcement.band_upgrade', { bandName: BAND_NAMES[newBand] });
  } else {
    await notify(userId, 'enforcement.band_downgrade', {
      previousBand: BAND_NAMES[previousBand],
      newBand: BAND_NAMES[newBand],
    });
  }
}

export async function loadEnforcementSettings(): Promise<{
  warningDurationDays: number;
  coachingBelow: number;
  warningBelow: number;
  restrictionBelow: number;
  preSuspensionBelow: number;
}> {
  const [wd, cb, wb, rb, psb] = await Promise.all([
    getPlatformSetting('score.enforcement.warningDurationDays', 30),
    getPlatformSetting('score.enforcement.coachingBelow', 550),
    getPlatformSetting('score.enforcement.warningBelow', 400),
    getPlatformSetting('score.enforcement.restrictionBelow', 250),
    getPlatformSetting('score.enforcement.preSuspensionBelow', 100),
  ]);
  return {
    warningDurationDays: Number(wd),
    coachingBelow: Number(cb),
    warningBelow: Number(wb),
    restrictionBelow: Number(rb),
    preSuspensionBelow: Number(psb),
  };
}
