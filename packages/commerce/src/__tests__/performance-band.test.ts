/**
 * Tests for performance-band.ts utility exports.
 * computePerformanceBand was removed in the D1 fix (Engine B deprecated).
 * Scoring math tests live in packages/scoring/src/__tests__/calculate-seller-score.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { getTrustBadge } from '../performance-band';

describe('getTrustBadge', () => {
  it('returns "Power Seller" for POWER_SELLER band', () => {
    expect(getTrustBadge('POWER_SELLER')).toBe('Power Seller');
  });

  it('returns "Top Rated Seller" for TOP_RATED band', () => {
    expect(getTrustBadge('TOP_RATED')).toBe('Top Rated Seller');
  });

  it('returns null for ESTABLISHED band', () => {
    expect(getTrustBadge('ESTABLISHED')).toBeNull();
  });

  it('returns null for EMERGING band', () => {
    expect(getTrustBadge('EMERGING')).toBeNull();
  });
});
