/**
 * Transaction Fee (TF) Calculator — Progressive Bracket System
 *
 * v3.2: TF is calculated using progressive/marginal brackets based on
 * seller's monthly GMV (Gross Merchandise Value) on Twicely.
 *
 * 8 progressive brackets (like income tax — each dollar taxed at its bracket rate):
 *
 * | Bracket | Monthly Twicely GMV    | Marginal Rate |
 * |---------|------------------------|---------------|
 * | 1       | $0 – $499              | 10.0%         |
 * | 2       | $500 – $1,999          | 11.0%         |
 * | 3       | $2,000 – $4,999        | 10.5%         |
 * | 4       | $5,000 – $9,999        | 10.0%         |
 * | 5       | $10,000 – $24,999      | 9.5%          |
 * | 6       | $25,000 – $49,999      | 9.0%          |
 * | 7       | $50,000 – $99,999      | 8.5%          |
 * | 8       | $100,000+              | 8.0%          |
 *
 * Rules:
 * - Minimum TF per order: $0.50 (50 cents)
 * - Calendar month reset: GMV counter resets on 1st of each month
 * - All money as integer cents, rates as basis points (1000 = 10.00%)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TfBracket {
  /** Upper limit in cents. null = unlimited (final bracket) */
  maxCents: number | null;
  /** Rate in basis points (1000 = 10.00%) */
  rateBps: number;
}

export interface TfBracketBreakdown {
  /** Index of the bracket (0-based) */
  bracketIndex: number;
  /** Amount from this sale taxed at this bracket rate (cents) */
  amountCents: number;
  /** Rate applied (basis points) */
  rateBps: number;
  /** TF calculated for this slice (cents) */
  tfCents: number;
}

export interface TfResult {
  /** Total TF in cents (minimum $0.50 enforced) */
  tfCents: number;
  /** Effective rate in basis points (tfCents / salePriceCents * 10000) */
  effectiveRateBps: number;
  /** Breakdown by bracket for display/audit */
  bracketBreakdown: TfBracketBreakdown[];
}

import { getPlatformSetting, getPlatformSettingsByPrefix } from '@twicely/db/queries/platform-settings';

// ─── Default Brackets (fallback if platform_settings unavailable) ────────────

export const DEFAULT_TF_BRACKETS: TfBracket[] = [
  { maxCents: 49900, rateBps: 1000 },     // $0-$499: 10.0%
  { maxCents: 199900, rateBps: 1100 },    // $500-$1,999: 11.0%
  { maxCents: 499900, rateBps: 1050 },    // $2,000-$4,999: 10.5%
  { maxCents: 999900, rateBps: 1000 },    // $5,000-$9,999: 10.0%
  { maxCents: 2499900, rateBps: 950 },    // $10,000-$24,999: 9.5%
  { maxCents: 4999900, rateBps: 900 },    // $25,000-$49,999: 9.0%
  { maxCents: 9999900, rateBps: 850 },    // $50,000-$99,999: 8.5%
  { maxCents: null, rateBps: 800 },       // $100,000+: 8.0%
];

/** Default minimum TF per order in cents ($0.50) — fallback only */
const DEFAULT_MINIMUM_TF_CENTS = 50;

// ─── Platform Settings Loaders ──────────────────────────────────────────────

/** Load TF brackets from platform_settings table (individual keys per bracket). */
export async function getTfBrackets(): Promise<TfBracket[]> {
  const settings = await getPlatformSettingsByPrefix('commerce.tf.bracket');
  if (settings.size === 0) return DEFAULT_TF_BRACKETS;

  // Discover bracket numbers from keys like commerce.tf.bracket1.maxCents
  const bracketNums = new Set<number>();
  for (const key of settings.keys()) {
    const match = key.match(/commerce\.tf\.bracket(\d+)\./);
    if (match && match[1]) bracketNums.add(parseInt(match[1], 10));
  }
  if (bracketNums.size === 0) return DEFAULT_TF_BRACKETS;

  const sorted = Array.from(bracketNums).sort((a, b) => a - b);
  return sorted.map((n) => {
    const maxCents = settings.get(`commerce.tf.bracket${n}.maxCents`) as number;
    const rateBps = settings.get(`commerce.tf.bracket${n}.rate`) as number;
    return { maxCents: maxCents === -1 ? null : maxCents, rateBps };
  });
}

/** Load minimum TF from platform_settings table. */
export async function getMinimumTfCents(): Promise<number> {
  return getPlatformSetting<number>('commerce.tf.minimumCents', DEFAULT_MINIMUM_TF_CENTS);
}

// ─── Main Calculator ─────────────────────────────────────────────────────────

/**
 * Calculate Transaction Fee using progressive brackets.
 *
 * The sale is added ON TOP of the seller's existing monthly GMV.
 * Each dollar of the sale is taxed at the bracket rate where it falls.
 *
 * @param sellerMonthlyGmvCents - Seller's GMV so far this calendar month (before this sale)
 * @param salePriceCents - Total sale price (item + shipping) in cents
 * @param brackets - Optional custom brackets (defaults to DEFAULT_TF_BRACKETS)
 * @returns TfResult with total TF, effective rate, and bracket breakdown
 *
 * @example
 * // Seller has $4,980 GMV, selling $50 item
 * calculateTf(498000, 5000)
 * // => { tfCents: 509, effectiveRateBps: 1018, bracketBreakdown: [...] }
 */
export function calculateTf(
  sellerMonthlyGmvCents: number,
  salePriceCents: number,
  brackets: TfBracket[] = DEFAULT_TF_BRACKETS,
  minimumTfCents: number = DEFAULT_MINIMUM_TF_CENTS
): TfResult {
  // Edge case: no sale
  if (salePriceCents <= 0) {
    return { tfCents: 0, effectiveRateBps: 0, bracketBreakdown: [] };
  }

  const breakdown: TfBracketBreakdown[] = [];
  let totalTfCents = 0;
  let remainingSaleCents = salePriceCents;
  let currentGmvCents = sellerMonthlyGmvCents;

  // Find starting bracket (where current GMV falls)
  let bracketIndex = 0;
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]!;
    if (bracket.maxCents === null || currentGmvCents < bracket.maxCents) {
      bracketIndex = i;
      break;
    }
  }

  // Process sale through brackets progressively
  while (remainingSaleCents > 0 && bracketIndex < brackets.length) {
    const bracket = brackets[bracketIndex]!;

    // Calculate how much room is left in this bracket
    let bracketCapacity: number;
    if (bracket.maxCents === null) {
      // Final bracket (unlimited)
      bracketCapacity = remainingSaleCents;
    } else {
      bracketCapacity = Math.max(0, bracket.maxCents - currentGmvCents);
    }

    // Amount of sale that falls in this bracket
    const amountInBracket = Math.min(remainingSaleCents, bracketCapacity);

    if (amountInBracket > 0) {
      // Calculate TF for this slice: Math.round(amountCents * rateBps / 10000)
      const tfForSlice = Math.round((amountInBracket * bracket.rateBps) / 10000);

      breakdown.push({
        bracketIndex,
        amountCents: amountInBracket,
        rateBps: bracket.rateBps,
        tfCents: tfForSlice,
      });

      totalTfCents += tfForSlice;
      remainingSaleCents -= amountInBracket;
      currentGmvCents += amountInBracket;
    }

    bracketIndex++;
  }

  // Enforce minimum TF (from platform_settings or fallback)
  const finalTfCents = Math.max(totalTfCents, minimumTfCents);

  // Calculate effective rate
  const effectiveRateBps = Math.round((finalTfCents / salePriceCents) * 10000);

  return {
    tfCents: finalTfCents,
    effectiveRateBps,
    bracketBreakdown: breakdown,
  };
}

// ─── Helper: Get Rate for Next Dollar ────────────────────────────────────────

/**
 * Get the rate (in basis points) that applies to the NEXT dollar sold.
 *
 * Useful for displaying "Your current TF rate: X%" to sellers.
 *
 * @param monthlyGmvCents - Seller's current monthly GMV in cents
 * @param brackets - Optional custom brackets (defaults to DEFAULT_TF_BRACKETS)
 * @returns Rate in basis points for the next dollar
 */
export function getEffectiveRate(
  monthlyGmvCents: number,
  brackets: TfBracket[] = DEFAULT_TF_BRACKETS
): number {
  for (const bracket of brackets) {
    if (bracket.maxCents === null || monthlyGmvCents < bracket.maxCents) {
      return bracket.rateBps;
    }
  }

  // Fallback to last bracket rate (should not reach here with valid brackets)
  return brackets[brackets.length - 1]?.rateBps ?? 1000;
}
