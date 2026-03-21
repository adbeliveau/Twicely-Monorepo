/**
 * C1.3 — Buyer Quality Tier
 *
 * Computes buyer quality tier based on:
 * - Return rate (trailing 90 days)
 * - Cancellation rate (trailing 90 days)
 * - Dispute count (trailing 90 days)
 *
 * Tiers:
 * - GREEN (default): Good standing
 * - YELLOW: Elevated risk - 5-15% return OR 10-25% cancel OR 1 dispute
 * - RED: High risk - >15% return OR >25% cancel OR 2+ disputes
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export type BuyerQualityTier = 'GREEN' | 'YELLOW' | 'RED';

export interface BuyerMetrics {
  totalOrders90d: number;
  returns90d: number;
  cancellations90d: number;
  disputes90d: number;
}

export interface BuyerQualityResult {
  tier: BuyerQualityTier;
  /** Whether to display the tier to sellers (false for buyers with < 5 orders) */
  visible: boolean;
  metrics: BuyerMetrics;
  rates: {
    returnRate: number;
    cancelRate: number;
  };
  flags: {
    highReturnRate: boolean;
    highCancelRate: boolean;
    hasDisputes: boolean;
  };
}

interface QualityThresholds {
  yellow: { returnRateMin: number; returnRateMax: number; cancelRateMin: number; cancelRateMax: number; disputeCount: number };
  red: { returnRate: number; cancelRate: number; disputeCount: number };
}

/** Load buyer quality thresholds from platform_settings (with hardcoded defaults). */
async function getThresholds(): Promise<QualityThresholds> {
  const [yrMin, yrMax, ycMin, ycMax, yd, rrr, rcr, rd] = await Promise.all([
    getPlatformSetting<number>('buyer.quality.yellow.returnRateMin', 0.05),
    getPlatformSetting<number>('buyer.quality.yellow.returnRateMax', 0.15),
    getPlatformSetting<number>('buyer.quality.yellow.cancelRateMin', 0.10),
    getPlatformSetting<number>('buyer.quality.yellow.cancelRateMax', 0.25),
    getPlatformSetting<number>('buyer.quality.yellow.disputeCount', 1),
    getPlatformSetting<number>('buyer.quality.red.returnRate', 0.15),
    getPlatformSetting<number>('buyer.quality.red.cancelRate', 0.25),
    getPlatformSetting<number>('buyer.quality.red.disputeCount', 2),
  ]);
  return {
    yellow: { returnRateMin: yrMin, returnRateMax: yrMax, cancelRateMin: ycMin, cancelRateMax: ycMax, disputeCount: yd },
    red: { returnRate: rrr, cancelRate: rcr, disputeCount: rd },
  };
}

/**
 * Compute buyer quality tier from metrics.
 */
export async function computeBuyerQuality(metrics: BuyerMetrics): Promise<BuyerQualityResult> {
  const { totalOrders90d, returns90d, cancellations90d, disputes90d } = metrics;
  const [thresholds, minOrdersForRates, minOrdersForVisibility] = await Promise.all([
    getThresholds(),
    getPlatformSetting<number>('buyer.quality.minOrdersForRates', 3),
    getPlatformSetting<number>('buyer.quality.minOrdersForVisibility', 5),
  ]);

  // Buyers with < minOrdersForVisibility get GREEN with visible=false (not enough data to judge)
  const visible = totalOrders90d >= minOrdersForVisibility;

  // Calculate rates (avoid division by zero)
  const returnRate = totalOrders90d >= minOrdersForRates
    ? returns90d / totalOrders90d
    : 0;
  const cancelRate = totalOrders90d >= minOrdersForRates
    ? cancellations90d / totalOrders90d
    : 0;

  // Early return for low-order buyers - always GREEN, not visible
  if (!visible) {
    return {
      tier: 'GREEN',
      visible: false,
      metrics,
      rates: { returnRate, cancelRate },
      flags: {
        highReturnRate: false,
        highCancelRate: false,
        hasDisputes: disputes90d > 0,
      },
    };
  }

  // Check RED tier conditions
  const isRedReturn = returnRate > thresholds.red.returnRate;
  const isRedCancel = cancelRate > thresholds.red.cancelRate;
  const isRedDispute = disputes90d >= thresholds.red.disputeCount;

  if (isRedReturn || isRedCancel || isRedDispute) {
    return {
      tier: 'RED',
      visible: true,
      metrics,
      rates: { returnRate, cancelRate },
      flags: {
        highReturnRate: isRedReturn,
        highCancelRate: isRedCancel,
        hasDisputes: disputes90d > 0,
      },
    };
  }

  // Check YELLOW tier conditions
  const isYellowReturn = returnRate >= thresholds.yellow.returnRateMin &&
                         returnRate <= thresholds.yellow.returnRateMax;
  const isYellowCancel = cancelRate >= thresholds.yellow.cancelRateMin &&
                         cancelRate <= thresholds.yellow.cancelRateMax;
  const isYellowDispute = disputes90d === thresholds.yellow.disputeCount;

  if (isYellowReturn || isYellowCancel || isYellowDispute) {
    return {
      tier: 'YELLOW',
      visible: true,
      metrics,
      rates: { returnRate, cancelRate },
      flags: {
        highReturnRate: isYellowReturn,
        highCancelRate: isYellowCancel,
        hasDisputes: disputes90d > 0,
      },
    };
  }

  // Default to GREEN
  return {
    tier: 'GREEN',
    visible: true,
    metrics,
    rates: { returnRate, cancelRate },
    flags: {
      highReturnRate: false,
      highCancelRate: false,
      hasDisputes: disputes90d > 0,
    },
  };
}

/**
 * Get a human-readable description of the buyer quality tier.
 */
export function getBuyerQualityDescription(tier: BuyerQualityTier): string {
  switch (tier) {
    case 'GREEN':
      return 'Good standing';
    case 'YELLOW':
      return 'Elevated risk';
    case 'RED':
      return 'High risk';
  }
}

/**
 * Check if a seller should see a warning for this buyer tier.
 */
export function shouldShowBuyerWarning(tier: BuyerQualityTier): boolean {
  return tier === 'YELLOW' || tier === 'RED';
}
