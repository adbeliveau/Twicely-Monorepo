/**
 * D2.4: Boosting / Promoted Listings Engine
 *
 * Async functions for boost validation and fee calculation.
 * Rates and limits are read from platform_settings at runtime.
 *
 * Business Rules (Pricing Canonical §10 + Decision Rationale §32):
 * - Boost rate: 1-8% of sale price (configurable via platform_settings)
 * - Attribution window: 7 days from boost start (configurable)
 * - Fee charged only on successful sale within attribution window
 * - Max 30% of search results can be promoted (configurable)
 * - Fee calculated on final sale price after discounts
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ─── Default Fallbacks (basis points / raw values) ──────────────────────────

/** 1% = 100 basis points */
const DEFAULT_BOOST_MIN_RATE_BPS = 100;

/** 8% = 800 basis points */
const DEFAULT_BOOST_MAX_RATE_BPS = 800;

/** 7 days */
const DEFAULT_BOOST_ATTRIBUTION_DAYS = 7;

/** 3000 bps = 30% cap (spec uses bps notation) */
const DEFAULT_BOOST_MAX_PROMOTED_PCT_BPS = 3000;

// ─── Async Getters (read from platform_settings) ───────────────────────────

/** Returns minimum boost rate as a percentage (e.g. 1 for 1%) */
export async function getBoostMinRate(): Promise<number> {
  const bps = await getPlatformSetting<number>(
    'boost.minRateBps',
    DEFAULT_BOOST_MIN_RATE_BPS,
  );
  return bps / 100;
}

/** Returns maximum boost rate as a percentage (e.g. 8 for 8%) */
export async function getBoostMaxRate(): Promise<number> {
  const bps = await getPlatformSetting<number>(
    'boost.maxRateBps',
    DEFAULT_BOOST_MAX_RATE_BPS,
  );
  return bps / 100;
}

/** Returns attribution window in days */
export async function getBoostAttributionDays(): Promise<number> {
  return getPlatformSetting<number>(
    'boost.attributionDays',
    DEFAULT_BOOST_ATTRIBUTION_DAYS,
  );
}

/** Returns max promoted percentage (e.g. 30 for 30%). Reads bps from platform_settings and divides by 100. */
export async function getBoostMaxPromotedPct(): Promise<number> {
  const bps = await getPlatformSetting<number>(
    'boost.maxPromotedPercentBps',
    DEFAULT_BOOST_MAX_PROMOTED_PCT_BPS,
  );
  return bps / 100;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface BoostRateValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates a boost rate percentage.
 * Min/max rates are read from platform_settings at runtime.
 */
export async function validateBoostRate(rate: number): Promise<BoostRateValidation> {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    return { valid: false, error: 'Boost rate must be a valid number' };
  }

  const minRate = await getBoostMinRate();
  if (rate < minRate) {
    return { valid: false, error: `Boost rate must be at least ${minRate}%` };
  }

  const maxRate = await getBoostMaxRate();
  if (rate > maxRate) {
    return { valid: false, error: `Boost rate cannot exceed ${maxRate}%` };
  }

  return { valid: true };
}

// ─── Fee Calculation ─────────────────────────────────────────────────────────

/**
 * Calculates the boost fee for a sale.
 * Fee is charged on the FINAL sale price after discounts.
 *
 * @param salePriceCents - Final sale price in cents (after discounts)
 * @param boostPercent - Boost rate as a percentage (e.g., 5 for 5%)
 * @returns Boost fee in cents, rounded to nearest cent
 */
export function calculateBoostFee(salePriceCents: number, boostPercent: number): number {
  if (salePriceCents <= 0) {
    return 0;
  }

  return Math.round(salePriceCents * (boostPercent / 100));
}

// ─── Attribution Window ──────────────────────────────────────────────────────

/**
 * Checks if a sale occurred within the attribution window.
 * Attribution days read from platform_settings at runtime.
 *
 * @param boostStartedAt - When the boost was activated
 * @param saleDate - When the sale occurred
 * @returns true if sale is within attribution window
 */
export async function isWithinAttributionWindow(
  boostStartedAt: Date,
  saleDate: Date,
): Promise<boolean> {
  const boostStart = boostStartedAt.getTime();
  const sale = saleDate.getTime();

  // Sale must be on or after boost start (no retroactive attribution)
  if (sale < boostStart) {
    return false;
  }

  // Calculate end of attribution window (strict less-than at boundary)
  const attributionDays = await getBoostAttributionDays();
  const msPerDay = 24 * 60 * 60 * 1000;
  const windowEndMs = boostStart + attributionDays * msPerDay;

  // Sale must be before window end (at boundary = expired)
  return sale < windowEndMs;
}

// ─── Search Result Slots ─────────────────────────────────────────────────────

/**
 * Calculates the maximum number of promoted slots for search results.
 * Max promoted percentage read from platform_settings at runtime.
 *
 * @param totalResults - Total number of search results
 * @returns Maximum number of promoted slots
 */
export async function calculatePromotedSlots(totalResults: number): Promise<number> {
  if (totalResults <= 0) {
    return 0;
  }

  const maxPct = await getBoostMaxPromotedPct();
  return Math.floor(totalResults * (maxPct / 100));
}
