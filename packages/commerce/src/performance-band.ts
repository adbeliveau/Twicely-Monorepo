/**
 * @deprecated Engine B (linear interpolation, REVIEW_IDEAL=5.0) was removed in the D1 fix.
 * All score computation now uses packages/scoring/src/calculate-seller-score.ts (Engine A).
 *
 * This file is kept because web consumers import `getTrustBadge`, `PerformanceBand`,
 * and `SellerMetrics` from it. Those pure utilities are unrelated to scoring math.
 *
 * DO NOT add new scoring logic here. See Seller Score Canonical §2 and @twicely/scoring.
 */

export type PerformanceBand = 'POWER_SELLER' | 'TOP_RATED' | 'ESTABLISHED' | 'EMERGING';

/**
 * Shape of the pre-aggregated metrics stored in the sellerPerformance table.
 * Used by buyer-facing queries (trust-metrics, storefront-public) for display only.
 * NOT used by the scoring engine — the engine reads live metric queries.
 */
export interface SellerMetrics {
  onTimeShippingPct: number;        // 0-100
  inadRate: number;                 // 0-1 (fraction)
  reviewAverage: number | null;     // 1-5 or null if no reviews
  responseTimeHours: number | null; // avg hours or null
  returnRate: number;               // 0-1 (fraction)
  cancelRate: number;               // 0-1 (fraction)
  totalOrders: number;              // for new seller detection
}

/**
 * Return a buyer-visible trust badge label for a seller's performance band.
 * Returns null for EMERGING and ESTABLISHED (no badge shown to buyers).
 */
export function getTrustBadge(band: PerformanceBand): string | null {
  switch (band) {
    case 'POWER_SELLER':
      return 'Power Seller';
    case 'TOP_RATED':
      return 'Top Rated Seller';
    default:
      return null;
  }
}
