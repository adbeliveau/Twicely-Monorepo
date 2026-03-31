/**
 * F4-S2: Lister Downgrade Warnings (Pure Function)
 *
 * Generates user-facing warnings when downgrading Crosslister tier.
 * NO DB calls — all data passed via context object.
 * Source: Pricing Canonical §6, Lister Canonical §7.3
 */

import type { ListerTier } from '@twicely/db/types';
import { compareListerTiers } from './subscription-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListerDowngradeContext {
  currentListerTier: ListerTier;
  targetListerTier: ListerTier;
  /** Number of publishes used this billing period */
  currentPublishUsage: number;
  /** Total rollover credit balance from publish-meter */
  currentRolloverBalance: number;
  /** Number of active crosslister_account rows (informational only) */
  connectedPlatformCount: number;
}

export interface ListerDowngradeWarning {
  feature: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

// ─── Monthly publish limits per tier (static tier definitions) ───────────────

const MONTHLY_LIMITS: Record<ListerTier, number> = {
  NONE: 0,
  FREE: 25,
  LITE: 200,
  PRO: 2000,
};

/** Max rollover cap = limit * 3 per canonical §6.4 */
const ROLLOVER_CAP: Record<ListerTier, number> = {
  NONE: 0,
  FREE: 0,     // FREE has no rollover
  LITE: 600,   // 200 * 3
  PRO: 6000,   // 2000 * 3
};

// ─── Warning Generation ───────────────────────────────────────────────────────

/**
 * Get warnings for downgrading from current to target lister tier.
 * Returns empty array if this is an upgrade, same tier, or involves NONE→* (not applicable here).
 * This is a PURE function — no DB calls.
 */
export function getListerDowngradeWarnings(
  ctx: ListerDowngradeContext,
): ListerDowngradeWarning[] {
  const warnings: ListerDowngradeWarning[] = [];
  const { currentListerTier, targetListerTier } = ctx;

  // Not a downgrade — return empty
  if (compareListerTiers(targetListerTier, currentListerTier) >= 0) {
    return warnings;
  }

  // --- Downgrading to NONE ---
  if (targetListerTier === 'NONE') {
    warnings.push({
      feature: 'Crosslisting',
      message:
        'You will lose all crosslisting capabilities. Active projections will remain on external platforms but cannot be updated or managed.',
      severity: 'critical',
    });
    return warnings;
  }

  // --- PRO → LITE ---
  if (currentListerTier === 'PRO' && targetListerTier === 'LITE') {
    warnings.push({
      feature: 'Monthly Publish Limit',
      message: `Your monthly publish limit drops from ${MONTHLY_LIMITS.PRO.toLocaleString()} to ${MONTHLY_LIMITS.LITE.toLocaleString()}. You have ${ctx.currentPublishUsage} publishes used this period.`,
      severity: 'warning',
    });

    const excessRollover = ctx.currentRolloverBalance - ROLLOVER_CAP.LITE;
    if (excessRollover > 0) {
      warnings.push({
        feature: 'Rollover Credits',
        message: `Your rollover credit cap drops from ${ROLLOVER_CAP.PRO.toLocaleString()} to ${ROLLOVER_CAP.LITE.toLocaleString()}. You will lose ${excessRollover} rollover credits.`,
        severity: 'warning',
      });
    }
    return warnings;
  }

  // --- LITE → FREE ---
  if (currentListerTier === 'LITE' && targetListerTier === 'FREE') {
    warnings.push({
      feature: 'Monthly Publish Limit',
      message: `Your monthly publish limit drops from ${MONTHLY_LIMITS.LITE.toLocaleString()} to ${MONTHLY_LIMITS.FREE.toLocaleString()}.`,
      severity: 'warning',
    });

    if (ctx.currentRolloverBalance > 0) {
      warnings.push({
        feature: 'Rollover Credits',
        message: `Rollover credits will be forfeited. You will lose ${ctx.currentRolloverBalance} unused rollover credits.`,
        severity: 'critical',
      });
    }

    warnings.push({
      feature: 'AI Features',
      message: 'AI credits and background removals will no longer be available.',
      severity: 'info',
    });
    return warnings;
  }

  // --- PRO → FREE ---
  if (currentListerTier === 'PRO' && targetListerTier === 'FREE') {
    warnings.push({
      feature: 'Monthly Publish Limit',
      message: `Your monthly publish limit drops from ${MONTHLY_LIMITS.PRO.toLocaleString()} to ${MONTHLY_LIMITS.FREE.toLocaleString()}.`,
      severity: 'warning',
    });

    if (ctx.currentRolloverBalance > 0) {
      warnings.push({
        feature: 'Rollover Credits',
        message: `Rollover credits will be forfeited. You will lose ${ctx.currentRolloverBalance} unused rollover credits.`,
        severity: 'critical',
      });
    }

    warnings.push({
      feature: 'AI Features',
      message: 'AI credits and background removals will no longer be available.',
      severity: 'info',
    });
    return warnings;
  }

  return warnings;
}
