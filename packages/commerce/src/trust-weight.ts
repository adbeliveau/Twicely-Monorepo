/**
 * C1.1 — Trust-Weighted Reviews
 *
 * Computes a trust weight for a reviewer (buyer) based on:
 * - Account age
 * - Verified purchases
 * - Review history
 * - Identity verification
 *
 * Weight range: 0.5 - 2.0 (default 1.0)
 */

export interface TrustWeightFactors {
  accountAgeDays: number;
  verifiedPurchases: number;
  reviewsSubmitted: number;
  isIdentityVerified: boolean;
}

export interface TrustWeightResult {
  weight: number;
  factors: TrustWeightFactors;
  breakdown: {
    base: number;
    ageBonus: number;
    purchaseBonus: number;
    reviewBonus: number;
    verifiedBonus: number;
  };
}

const MIN_WEIGHT = 0.5;
const MAX_WEIGHT = 2.0;
const BASE_WEIGHT = 1.0;

// Age bonuses (up to 0.3)
const AGE_THRESHOLDS = [
  { days: 365, bonus: 0.3 },  // 1+ year
  { days: 180, bonus: 0.2 },  // 6+ months
  { days: 90, bonus: 0.1 },   // 3+ months
  { days: 30, bonus: 0.05 },  // 1+ month
] as const;

// Purchase bonuses (up to 0.3)
const PURCHASE_THRESHOLDS = [
  { count: 20, bonus: 0.3 },
  { count: 10, bonus: 0.2 },
  { count: 5, bonus: 0.1 },
  { count: 1, bonus: 0.05 },
] as const;

// Review bonuses (up to 0.2)
const REVIEW_THRESHOLDS = [
  { count: 15, bonus: 0.2 },
  { count: 10, bonus: 0.15 },
  { count: 5, bonus: 0.1 },
  { count: 1, bonus: 0.05 },
] as const;

// Identity verification bonus
const VERIFIED_BONUS = 0.2;

/**
 * Compute trust weight for a reviewer.
 * Used to weight review scores in seller rating calculations.
 */
export function computeReviewerTrustWeight(factors: TrustWeightFactors): TrustWeightResult {
  // Calculate age bonus
  let ageBonus = 0;
  for (const threshold of AGE_THRESHOLDS) {
    if (factors.accountAgeDays >= threshold.days) {
      ageBonus = threshold.bonus;
      break;
    }
  }

  // Calculate purchase bonus
  let purchaseBonus = 0;
  for (const threshold of PURCHASE_THRESHOLDS) {
    if (factors.verifiedPurchases >= threshold.count) {
      purchaseBonus = threshold.bonus;
      break;
    }
  }

  // Calculate review bonus
  let reviewBonus = 0;
  for (const threshold of REVIEW_THRESHOLDS) {
    if (factors.reviewsSubmitted >= threshold.count) {
      reviewBonus = threshold.bonus;
      break;
    }
  }

  // Identity verification bonus
  const verifiedBonus = factors.isIdentityVerified ? VERIFIED_BONUS : 0;

  // Calculate total weight
  const rawWeight = BASE_WEIGHT + ageBonus + purchaseBonus + reviewBonus + verifiedBonus;
  const weight = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, rawWeight));

  return {
    weight,
    factors,
    breakdown: {
      base: BASE_WEIGHT,
      ageBonus,
      purchaseBonus,
      reviewBonus,
      verifiedBonus,
    },
  };
}

/**
 * Calculate weighted average rating from reviews with trust weights.
 */
export function computeWeightedAverageRating(
  reviews: Array<{ rating: number; trustWeight: number }>
): number | null {
  if (reviews.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const review of reviews) {
    weightedSum += review.rating * review.trustWeight;
    totalWeight += review.trustWeight;
  }

  if (totalWeight === 0) return null;

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
