/**
 * Local Transaction Fee Utilities (B3.4, updated per Decision #118)
 *
 * Per Decision #118 (2026-03-10):
 * - The 5% flat local TF rate is DEPRECATED
 * - Local sales now use the SAME progressive TF brackets as shipped orders
 * - Local sales still do NOT count toward monthly GMV for bracket progression
 * - $0.50 minimum TF applies (same as shipped orders)
 *
 * Per TWICELY_V3_LOCAL_CANONICAL.md §4, §8:
 * - Buyer selects Local Pickup → pays item + progressive TF + Stripe processing
 *
 * Per TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md §15:
 * - Local sales use same progressive brackets as shipped (Decision #118)
 * - Does NOT count toward monthly GMV for bracket calculation
 */

import { calculateTf, getTfBrackets, getMinimumTfCents } from '@twicely/commerce/tf-calculator';
import type { TfResult } from '@twicely/commerce/tf-calculator';

// ─── Calculator ──────────────────────────────────────────────────────────────

/**
 * Calculate Transaction Fee for local pickup orders using progressive brackets.
 *
 * Uses the same progressive TF brackets as shipped orders (Decision #118).
 * The sale amount does NOT count toward seller's monthly GMV.
 * $0.50 minimum TF applies (same as shipped orders).
 *
 * NOTE: Caller must NOT add the sale to GMV running total — local sales
 * don't count toward GMV for bracket progression.
 *
 * @param sellerMonthlyGmvCents - Seller's GMV so far this calendar month
 * @param salePriceCents - Item price in cents (no shipping for local pickup)
 * @returns TfResult with TF amount, effective rate, and bracket breakdown
 *
 * @example
 * calculateLocalTfFromBrackets(0, 5000) // $50 item, seller at $0 GMV
 * // => { tfCents: 500, effectiveRateBps: 1000, bracketBreakdown: [...] }
 */
export async function calculateLocalTfFromBrackets(
  sellerMonthlyGmvCents: number,
  salePriceCents: number,
): Promise<TfResult> {
  const brackets = await getTfBrackets();
  const minimumTfCents = await getMinimumTfCents();
  return calculateTf(sellerMonthlyGmvCents, salePriceCents, brackets, minimumTfCents);
}

// ─── Fulfillment Helpers ─────────────────────────────────────────────────────

/**
 * Check if a listing supports local pickup.
 *
 * @param fulfillmentType - The listing's fulfillment type
 * @returns true if local pickup is available
 */
export function supportsLocalPickup(
  fulfillmentType: 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL'
): boolean {
  return fulfillmentType === 'LOCAL_ONLY' || fulfillmentType === 'SHIP_AND_LOCAL';
}

/**
 * Check if a listing supports shipping.
 *
 * @param fulfillmentType - The listing's fulfillment type
 * @returns true if shipping is available
 */
export function supportsShipping(
  fulfillmentType: 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL'
): boolean {
  return fulfillmentType === 'SHIP_ONLY' || fulfillmentType === 'SHIP_AND_LOCAL';
}
