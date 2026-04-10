/**
 * Risk Signal Recording Service (Canonical 26 §6.1 + §6.2)
 *
 * Records risk signals with platform_settings-driven base scores.
 * Resolves signals with staff attribution and audit trail.
 * All signals are append-only — never deleted, only resolved.
 */

import { db } from '@twicely/db';
import { riskSignal } from '@twicely/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import type { RecordSignalArgs, RiskSignalType } from './types';
import {
  DEFAULT_SIGNAL_BASE_SCORES,
  getSignalSettingKey,
  isValidSignalType,
  severityFromScore,
  UNKNOWN_SIGNAL_FALLBACK_SCORE,
} from './signal-types';

/**
 * Record a new risk signal for a user.
 *
 * - Reads base score from platform_settings (falls back to DEFAULT_SIGNAL_BASE_SCORES)
 * - Applies optional scoreMultiplier (capped so final score <= 100)
 * - Computes severity from final score
 * - Inserts riskSignal row
 *
 * @returns The inserted signal row
 */
export async function recordRiskSignal(args: RecordSignalArgs) {
  const { userId, sellerId, signalType, scoreMultiplier = 1, source = 'system', meta = {} } = args;

  // Read base score from platform_settings, fall back to hardcoded default
  let baseScore: number;
  if (isValidSignalType(signalType)) {
    const settingKey = getSignalSettingKey(signalType);
    const defaultScore = DEFAULT_SIGNAL_BASE_SCORES[signalType];
    baseScore = await getPlatformSetting<number>(settingKey, defaultScore);
  } else {
    // Unknown signal type — use fallback score
    baseScore = UNKNOWN_SIGNAL_FALLBACK_SCORE;
  }

  // Apply multiplier and cap at 100
  const finalScore = Math.min(100, Math.round(baseScore * scoreMultiplier));
  const severity = severityFromScore(finalScore);

  const [inserted] = await db
    .insert(riskSignal)
    .values({
      userId,
      sellerId: sellerId ?? null,
      signalType,
      score: finalScore,
      severity,
      metaJson: meta,
      source,
    })
    .returning();

  logger.info('Risk signal recorded', {
    signalId: inserted.id,
    userId,
    signalType,
    score: finalScore,
    severity,
    source,
  });

  return inserted;
}

/**
 * Resolve a risk signal (mark as no longer active).
 *
 * - Sets resolved=true with timestamp and staff attribution
 * - Does not delete — append-only audit trail preserved
 *
 * @returns The updated signal row, or null if not found
 */
export async function resolveRiskSignal(
  signalId: string,
  staffActorId: string,
  reason?: string
) {
  const [updated] = await db
    .update(riskSignal)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedByStaffId: staffActorId,
      resolvedReason: reason ?? null,
    })
    .where(eq(riskSignal.id, signalId))
    .returning();

  if (updated) {
    logger.info('Risk signal resolved', {
      signalId,
      staffActorId,
      reason,
    });
  }

  return updated ?? null;
}

/**
 * Get all unresolved signals for a user within a time window.
 *
 * @param userId - The user to query
 * @param windowHours - How far back to look (default: 24)
 * @returns Array of unresolved signal rows
 */
export async function getUnresolvedSignals(userId: string, windowHours = 24) {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  return db
    .select()
    .from(riskSignal)
    .where(
      and(
        eq(riskSignal.userId, userId),
        eq(riskSignal.resolved, false),
        gte(riskSignal.occurredAt, windowStart)
      )
    );
}

/**
 * Count recent signals of a specific type for a user (used by auto-signal logic).
 */
export async function countRecentSignals(
  userId: string,
  signalType: RiskSignalType,
  windowMinutes: number
): Promise<number> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const rows = await db
    .select({ id: riskSignal.id })
    .from(riskSignal)
    .where(
      and(
        eq(riskSignal.userId, userId),
        eq(riskSignal.signalType, signalType),
        gte(riskSignal.occurredAt, windowStart)
      )
    );

  return rows.length;
}
