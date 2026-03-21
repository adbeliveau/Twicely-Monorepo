import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    userId: 'user_id', id: 'id', sellerScore: 'seller_score', isNew: 'is_new',
    performanceBand: 'performance_band', sellerScoreUpdatedAt: 'seller_score_updated_at',
    enforcementLevel: 'enforcement_level', boostCreditCents: 'boost_credit_cents',
  },
  sellerPerformance: {
    sellerProfileId: 'seller_profile_id', completedOrders: 'completed_orders', averageRating: 'average_rating',
  },
  sellerScoreSnapshot: {
    userId: 'user_id', snapshotDate: 'snapshot_date', overallScore: 'overall_score',
    performanceBand: 'performance_band', shippingScore: 'shipping_score', inadScore: 'inad_score',
    reviewScore: 'review_score', responseScore: 'response_score', returnScore: 'return_score',
    cancellationScore: 'cancellation_score', onTimeShippingPct: 'on_time_shipping_pct',
    inadClaimRatePct: 'inad_claim_rate_pct', reviewAverage: 'review_average',
    responseTimeHours: 'response_time_hours', returnRatePct: 'return_rate_pct',
    cancellationRatePct: 'cancellation_rate_pct', primaryFeeBucket: 'primary_fee_bucket',
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@/lib/scoring/calculate-seller-score', () => ({
  calculateTrend: vi.fn().mockReturnValue('STEADY'),
}));

function makeSelectChain(resolveValue: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSellerScoreData', () => {
  it('returns score data for valid seller', async () => {
    const profileChain = makeSelectChain([{
      sellerScore: 750, isNew: false, performanceBand: 'TOP_RATED',
      sellerScoreUpdatedAt: new Date(), enforcementLevel: null,
      boostCreditCents: 0, sellerProfileId: 'sp-1',
    }]);
    const perfChain = makeSelectChain([{ completedOrders: 50, averageRating: 4.8 }]);
    mockDbSelect.mockReturnValueOnce(profileChain).mockReturnValueOnce(perfChain);

    const { getSellerScoreData } = await import('../seller-score');
    const result = await getSellerScoreData('user-1');

    expect(result).not.toBeNull();
    expect(result?.sellerScore).toBe(750);
    expect(result?.performanceBand).toBe('TOP_RATED');
    expect(result?.completedOrders).toBe(50);
  });

  it('returns null for non-seller', async () => {
    const profileChain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(profileChain);

    const { getSellerScoreData } = await import('../seller-score');
    const result = await getSellerScoreData('non-seller');

    expect(result).toBeNull();
  });
});

describe('getScoreHistory', () => {
  it('returns score history for 30/60/90 day ranges', async () => {
    // DB returns desc order (newest first). getScoreHistory reverses to oldest-first.
    const fakeSnapshots = [
      { snapshotDate: '2025-01-02', overallScore: 650, performanceBand: 'ESTABLISHED' },
      { snapshotDate: '2025-01-01', overallScore: 600, performanceBand: 'ESTABLISHED' },
    ];
    const histChain = makeSelectChain(fakeSnapshots);
    mockDbSelect.mockReturnValue(histChain);

    const { getScoreHistory } = await import('../seller-score');
    const result30 = await getScoreHistory('user-1', 30);
    expect(result30).toHaveLength(2);
    expect(result30[0]?.score).toBe(600);
    expect(result30[1]?.score).toBe(650);
  });

  it('returns empty array when no history', async () => {
    const histChain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(histChain);

    const { getScoreHistory } = await import('../seller-score');
    const result = await getScoreHistory('user-1', 90);
    expect(result).toHaveLength(0);
  });
});

describe('getMetricBreakdown', () => {
  it('returns 6 metric breakdown items', async () => {
    const snapshotData = [{
      onTimeShippingPct: 0.95, inadClaimRatePct: 0.01, reviewAverage: 4.8,
      responseTimeHours: 3, returnRatePct: 0.02, cancellationRatePct: 0.01,
      shippingScore: 900, inadScore: 950, reviewScore: 850, responseScore: 980,
      returnScore: 960, cancellationScore: 970, primaryFeeBucket: 'ELECTRONICS',
    }];
    const snapshotChain = makeSelectChain(snapshotData);
    mockDbSelect.mockReturnValue(snapshotChain);

    const { getMetricBreakdown } = await import('../seller-score');
    const result = await getMetricBreakdown('user-1');

    expect(result.metrics).toHaveLength(6);
    expect(result.metrics.map((m) => m.key)).toEqual([
      'onTimeShipping', 'inadRate', 'reviewAverage', 'responseTime', 'returnRate', 'cancellationRate',
    ]);
  });
});
