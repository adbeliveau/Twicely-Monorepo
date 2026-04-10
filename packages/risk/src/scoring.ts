/**
 * Risk Score Computation Engine (Canonical 26 §6.3)
 *
 * Computes composite risk scores per user by aggregating unresolved signals
 * within a configurable sliding window. Supports per-action threshold lookup,
 * caching via the riskScore table, and a global kill switch.
 */

import { db } from '@twicely/db';
import { riskSignal, riskScore, riskThreshold } from '@twicely/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type {
  ComputeScoreArgs,
  RiskScoreResult,
  RiskRecommendation,
  RiskThresholdConfig,
} from './types';
import { DEFAULT_THRESHOLDS } from './types';
import { severityFromScore } from './signal-types';

// ─── Seller-context signal types (signals that count toward sellerScore) ────

const SELLER_SIGNAL_TYPES = new Set([
  'unusual_volume',
  'listing_manipulation',
  'shill_bidding',
  'return_fraud_ring',
  'payout_change',
  'local_fraud',
]);

/**
 * Compute a risk score for a user in the context of a specific action.
 *
 * 1. Check kill switch (risk.enabled) — if off, return score 0 + allow
 * 2. Check cache (riskScore table) — return cached if within cacheMinutes
 * 3. Query unresolved signals within sliding window
 * 4. Sum scores, cap at maxScore
 * 5. Split buyer/seller scores
 * 6. Look up per-action threshold
 * 7. Upsert riskScore cache
 * 8. Return composite result with recommendation
 */
export async function computeRiskScore(args: ComputeScoreArgs): Promise<RiskScoreResult> {
  const { userId, action } = args;

  // 1. Kill switch check
  const enabled = await getPlatformSetting<boolean>('risk.enabled', true);
  if (!enabled) {
    return {
      userId,
      compositeScore: 0,
      buyerScore: 0,
      sellerScore: 0,
      severity: 'LOW',
      signalCount: 0,
      recommendation: 'allow',
      signals: [],
    };
  }

  // 2. Cache check
  const cacheMinutes = await getPlatformSetting<number>('risk.scoring.cacheMinutes', 1);
  const cacheThreshold = new Date(Date.now() - cacheMinutes * 60 * 1000);

  const [cached] = await db
    .select()
    .from(riskScore)
    .where(eq(riskScore.userId, userId))
    .limit(1);

  if (cached && cached.lastComputedAt >= cacheThreshold) {
    const threshold = await lookupThreshold(action);
    const recommendation = deriveRecommendation(cached.compositeScore, threshold);

    return {
      userId,
      compositeScore: cached.compositeScore,
      buyerScore: cached.buyerScore,
      sellerScore: cached.sellerScore,
      severity: severityFromScore(cached.compositeScore),
      signalCount: cached.signalCount,
      recommendation,
      signals: [],
    };
  }

  // 3. Query unresolved signals within sliding window
  const windowHours = await getPlatformSetting<number>('risk.scoring.windowHours', 24);
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const signals = await db
    .select()
    .from(riskSignal)
    .where(
      and(
        eq(riskSignal.userId, userId),
        eq(riskSignal.resolved, false),
        gte(riskSignal.occurredAt, windowStart)
      )
    );

  // 4. Sum scores, cap at maxScore
  const maxScore = await getPlatformSetting<number>('risk.scoring.maxScore', 100);
  let totalScore = 0;
  let buyerTotal = 0;
  let sellerTotal = 0;

  for (const signal of signals) {
    totalScore += signal.score;
    if (SELLER_SIGNAL_TYPES.has(signal.signalType)) {
      sellerTotal += signal.score;
    } else {
      buyerTotal += signal.score;
    }
  }

  // 5. Cap scores
  const compositeScore = Math.min(maxScore, totalScore);
  const buyerScore = Math.min(maxScore, buyerTotal);
  const sellerScore = Math.min(maxScore, sellerTotal);
  const severity = severityFromScore(compositeScore);

  // 6. Threshold lookup
  const threshold = await lookupThreshold(action);
  const recommendation = deriveRecommendation(compositeScore, threshold);

  // 7. Upsert riskScore cache
  const lastSignalAt = signals.length > 0
    ? signals.reduce((latest: Date, s: typeof signals[number]) => (s.occurredAt > latest ? s.occurredAt : latest), signals[0].occurredAt)
    : null;

  try {
    if (cached) {
      await db
        .update(riskScore)
        .set({
          buyerScore,
          sellerScore,
          compositeScore,
          severity,
          signalCount: signals.length,
          lastSignalAt,
          lastComputedAt: new Date(),
        })
        .where(eq(riskScore.userId, userId));
    } else {
      await db
        .insert(riskScore)
        .values({
          userId,
          buyerScore,
          sellerScore,
          compositeScore,
          severity,
          signalCount: signals.length,
          lastSignalAt,
          lastComputedAt: new Date(),
        });
    }
  } catch (err) {
    // Cache write failure is non-fatal — log and continue
    logger.warn('Risk score cache upsert failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    userId,
    compositeScore,
    buyerScore,
    sellerScore,
    severity,
    signalCount: signals.length,
    recommendation,
    signals: signals.map((s: typeof signals[number]) => ({
      id: s.id,
      userId: s.userId,
      sellerId: s.sellerId,
      signalType: s.signalType,
      score: s.score,
      severity: s.severity,
      metaJson: s.metaJson,
      source: s.source,
      resolved: s.resolved,
      occurredAt: s.occurredAt,
    })),
  };
}

/**
 * Look up the per-action threshold. Returns default if not found or inactive.
 */
async function lookupThreshold(action: string): Promise<RiskThresholdConfig> {
  const [row] = await db
    .select()
    .from(riskThreshold)
    .where(eq(riskThreshold.action, action))
    .limit(1);

  if (row && row.isActive) {
    return {
      action: row.action,
      warnAt: row.warnAt,
      stepUpAt: row.stepUpAt,
      blockAt: row.blockAt,
      isActive: row.isActive,
    };
  }

  // Use default thresholds if action is a known gated action
  const defaults = DEFAULT_THRESHOLDS[action as keyof typeof DEFAULT_THRESHOLDS];
  if (defaults) {
    return {
      action,
      warnAt: defaults.warnAt,
      stepUpAt: defaults.stepUpAt,
      blockAt: defaults.blockAt,
      isActive: true,
    };
  }

  // Fallback to canonical defaults (C26 §5)
  return {
    action,
    warnAt: 31,
    stepUpAt: 61,
    blockAt: 81,
    isActive: true,
  };
}

/**
 * Derive recommendation from a score and threshold config.
 */
function deriveRecommendation(score: number, threshold: RiskThresholdConfig): RiskRecommendation {
  if (score >= threshold.blockAt) return 'block';
  if (score >= threshold.stepUpAt) return 'step_up';
  if (score >= threshold.warnAt) return 'warn';
  return 'allow';
}
