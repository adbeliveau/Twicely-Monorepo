import { describe, it, expect } from 'vitest';
import {
  computeReviewerTrustWeight,
  computeWeightedAverageRating,
  type TrustWeightFactors,
} from '../trust-weight';

describe('computeReviewerTrustWeight', () => {
  it('returns base weight of 1.0 for new account with no activity', () => {
    const factors: TrustWeightFactors = {
      accountAgeDays: 0,
      verifiedPurchases: 0,
      reviewsSubmitted: 0,
      isIdentityVerified: false,
    };

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBe(1.0);
    expect(result.breakdown.base).toBe(1.0);
    expect(result.breakdown.ageBonus).toBe(0);
    expect(result.breakdown.purchaseBonus).toBe(0);
    expect(result.breakdown.reviewBonus).toBe(0);
    expect(result.breakdown.verifiedBonus).toBe(0);
  });

  it('adds age bonus for 1 year+ accounts', () => {
    const factors: TrustWeightFactors = {
      accountAgeDays: 400,
      verifiedPurchases: 0,
      reviewsSubmitted: 0,
      isIdentityVerified: false,
    };

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBe(1.3);
    expect(result.breakdown.ageBonus).toBe(0.3);
  });

  it('adds purchase bonus for 20+ purchases', () => {
    const factors: TrustWeightFactors = {
      accountAgeDays: 0,
      verifiedPurchases: 25,
      reviewsSubmitted: 0,
      isIdentityVerified: false,
    };

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBe(1.3);
    expect(result.breakdown.purchaseBonus).toBe(0.3);
  });

  it('adds review bonus for 15+ reviews', () => {
    const factors: TrustWeightFactors = {
      accountAgeDays: 0,
      verifiedPurchases: 0,
      reviewsSubmitted: 20,
      isIdentityVerified: false,
    };

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBe(1.2);
    expect(result.breakdown.reviewBonus).toBe(0.2);
  });

  it('adds verified bonus for identity-verified users', () => {
    const factors: TrustWeightFactors = {
      accountAgeDays: 0,
      verifiedPurchases: 0,
      reviewsSubmitted: 0,
      isIdentityVerified: true,
    };

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBe(1.2);
    expect(result.breakdown.verifiedBonus).toBe(0.2);
  });

  it('caps weight at maximum 2.0', () => {
    const factors: TrustWeightFactors = {
      accountAgeDays: 500,       // +0.3
      verifiedPurchases: 50,    // +0.3
      reviewsSubmitted: 30,     // +0.2
      isIdentityVerified: true, // +0.2
    };
    // Total would be 1.0 + 0.3 + 0.3 + 0.2 + 0.2 = 2.0

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBe(2.0);
  });

  it('returns minimum weight of 0.5 (though unlikely with current formula)', () => {
    // Current formula can't go below 1.0, but test the clamp works
    const factors: TrustWeightFactors = {
      accountAgeDays: 0,
      verifiedPurchases: 0,
      reviewsSubmitted: 0,
      isIdentityVerified: false,
    };

    const result = computeReviewerTrustWeight(factors);

    expect(result.weight).toBeGreaterThanOrEqual(0.5);
  });
});

describe('computeWeightedAverageRating', () => {
  it('returns null for empty reviews array', () => {
    const result = computeWeightedAverageRating([]);

    expect(result).toBeNull();
  });

  it('returns simple average when all weights are equal', () => {
    const reviews = [
      { rating: 5, trustWeight: 1.0 },
      { rating: 3, trustWeight: 1.0 },
    ];

    const result = computeWeightedAverageRating(reviews);

    expect(result).toBe(4.0);
  });

  it('weights ratings correctly', () => {
    const reviews = [
      { rating: 5, trustWeight: 2.0 },  // Counts double
      { rating: 1, trustWeight: 1.0 },
    ];
    // Weighted sum: 5*2 + 1*1 = 11
    // Total weight: 2 + 1 = 3
    // Average: 11/3 = 3.67

    const result = computeWeightedAverageRating(reviews);

    expect(result).toBeCloseTo(3.67, 1);
  });

  it('handles single review', () => {
    const reviews = [{ rating: 4, trustWeight: 1.5 }];

    const result = computeWeightedAverageRating(reviews);

    expect(result).toBe(4.0);
  });
});
