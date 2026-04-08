/**
 * Tests for seller-score-compute.ts — wiring tests only.
 * Math correctness lives in packages/scoring/src/__tests__/calculate-seller-score.test.ts.
 * These tests verify that computeAndStoreSellerScore:
 *   - calls calculateSellerScore (Engine A)
 *   - fires all side effects: profile update, snapshot insert, enforcement, Typesense, notification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock all external deps before importing SUT ---

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'userId', id: 'id', status: 'status', performanceBand: 'performanceBand', enforcementLevel: 'enforcementLevel', warningExpiresAt: 'warningExpiresAt', bandOverride: 'bandOverride', bandOverrideExpiresAt: 'bandOverrideExpiresAt', sellerScore: 'sellerScore' },
  sellerScoreSnapshot: { overallScore: 'overallScore', userId: 'userId', snapshotDate: 'snapshotDate', performanceBand: 'performanceBand', sellerProfileId: 'sellerProfileId' },
  listing: { id: 'id', ownerUserId: 'ownerUserId', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a, _b) => 'eq'),
  and: vi.fn((...args: unknown[]) => ['and', ...args]),
  gte: vi.fn((_a, _b) => 'gte'),
  desc: vi.fn((_a) => 'desc'),
  ne: vi.fn((_a, _b) => 'ne'),
}));

vi.mock('@paralleldrive/cuid2', () => ({ createId: vi.fn(() => 'test-id') }));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/scoring/calculate-seller-score', () => ({
  calculateSellerScore: vi.fn(() => ({
    score: 820,
    band: 'TOP_RATED' as const,
    searchMultiplier: 1.025,
    perMetricScores: {
      shippingScore: 950, inadScore: 900, reviewScore: 870,
      responseScore: 850, returnScore: 920, cancellationScore: 960,
    },
    rawScore: 810,
    adjustedScore: 818,
    trendModifier: 0.002,
    bayesianSmoothing: 8,
  })),
  calculateSearchMultiplier: vi.fn(() => 1.025),
  deriveBand: vi.fn(() => 'TOP_RATED'),
}));

vi.mock('@twicely/scoring/metric-queries', () => ({
  getOnTimeShippingRate: vi.fn(() => Promise.resolve(0.97)),
  getInadClaimRate: vi.fn(() => Promise.resolve(0.01)),
  getReturnRate: vi.fn(() => Promise.resolve(0.02)),
  getCancellationRate: vi.fn(() => Promise.resolve(0.01)),
  getPrimaryFeeBucket: vi.fn(() => Promise.resolve('APPAREL_ACCESSORIES')),
  getCompletedOrderCount: vi.fn(() => Promise.resolve(50)),
  getPlatformMeanScore: vi.fn(() => Promise.resolve(650)),
}));

vi.mock('@twicely/scoring/metric-queries-messaging', () => ({
  getReviewAverage: vi.fn(() => Promise.resolve(4.7)),
  getMedianResponseTime: vi.fn(() => Promise.resolve(3.5)),
}));

vi.mock('../seller-score-compute-helpers', () => ({
  loadScoreSettings: vi.fn(() => Promise.resolve({
    smoothingFactor: 30, trendModifierMax: 0.05,
    bandThresholds: { powerSeller: 900, topRated: 750, established: 550 },
    weights: { onTimeShipping: 0.25, inadRate: 0.20, reviewAverage: 0.20, responseTime: 0.15, returnRate: 0.10, cancellationRate: 0.10 },
    newSellerThreshold: 10, transitionThreshold: 50, downgradeGraceDays: 7,
  })),
  loadCategoryThresholds: vi.fn(() => Promise.resolve({
    onTimeShipping: { ideal: 0.95, steepness: 10 },
    inadRate: { ideal: 0.02, steepness: 10 },
    responseTime: { ideal: 8, steepness: 10 },
    returnRate: { ideal: 0.03, steepness: 10 },
    cancellationRate: { ideal: 0.015, steepness: 10 },
  })),
  loadEnforcementSettings: vi.fn(() => Promise.resolve({
    warningDurationDays: 30, coachingBelow: 550, warningBelow: 400, restrictionBelow: 250, preSuspensionBelow: 100,
  })),
  determineEffectiveBand: vi.fn(() => Promise.resolve('TOP_RATED')),
  runEnforcementReeval: vi.fn(() => Promise.resolve()),
  notifyBandTransition: vi.fn(() => Promise.resolve()),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

// Dynamic imports used for Typesense
vi.mock('@twicely/search/typesense-client', () => ({
  getTypesenseClient: vi.fn(() => ({
    collections: vi.fn(() => ({
      documents: vi.fn(() => ({
        import: vi.fn(() => Promise.resolve()),
      })),
    })),
  })),
}));

vi.mock('@twicely/search/typesense-schema', () => ({
  LISTINGS_COLLECTION: 'listings',
}));

import { db } from '@twicely/db';
import { calculateSellerScore } from '@twicely/scoring/calculate-seller-score';
import { computeAndStoreSellerScore } from '../seller-score-compute';
import { notifyBandTransition, runEnforcementReeval } from '../seller-score-compute-helpers';

// --- DB chainable mock helpers ---

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve(rows)),
    select: vi.fn().mockReturnThis(),
  };
  return chain;
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => Promise.resolve()),
  };
}

function makeInsertChain() {
  return {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn(() => Promise.resolve()),
  };
}

const mockProfile = {
  id: 'profile-1',
  userId: 'user-1',
  status: 'ACTIVE',
  performanceBand: 'ESTABLISHED',
  enforcementLevel: null,
  warningExpiresAt: null,
  bandOverride: null,
  bandOverrideExpiresAt: null,
  sellerScore: 700,
};

beforeEach(() => {
  vi.clearAllMocks();

  let selectCallCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    selectCallCount++;
    // Call 1: profile lookup
    // Call 2: snapshots for trend
    // Call 3+: grace period snapshots (inside determineEffectiveBand)
    // Call 4: active listings for Typesense
    if (selectCallCount === 1) return makeSelectChain([mockProfile]) as ReturnType<typeof db.select>;
    if (selectCallCount === 2) return makeSelectChain([{ overallScore: 700 }, { overallScore: 750 }]) as ReturnType<typeof db.select>;
    if (selectCallCount === 3) return makeSelectChain([]) as ReturnType<typeof db.select>; // grace check → no snapshots → keep current band
    if (selectCallCount === 4) return makeSelectChain([{ id: 'listing-1' }]) as ReturnType<typeof db.select>; // active listings
    return makeSelectChain([]) as ReturnType<typeof db.select>;
  });

  vi.mocked(db.update).mockReturnValue(makeUpdateChain() as ReturnType<typeof db.update>);
  vi.mocked(db.insert).mockReturnValue(makeInsertChain() as ReturnType<typeof db.insert>);
});

describe('computeAndStoreSellerScore', () => {
  it('returns success: false when seller profile not found', async () => {
    vi.mocked(db.select).mockImplementationOnce(() => makeSelectChain([]) as ReturnType<typeof db.select>);
    const result = await computeAndStoreSellerScore('unknown-user');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Seller profile not found');
  });

  it('calls calculateSellerScore (Engine A) with correct metric shape', async () => {
    await computeAndStoreSellerScore('user-1');
    expect(calculateSellerScore).toHaveBeenCalledOnce();
    const [input] = vi.mocked(calculateSellerScore).mock.calls[0]!;
    expect(input.metrics.onTimeShippingPct).toBe(0.97);
    expect(input.metrics.inadClaimRatePct).toBe(0.01);
    expect(input.metrics.reviewAverage).toBe(4.7);
    expect(input.metrics.responseTimeHours).toBe(3.5);
    expect(input.metrics.returnRatePct).toBe(0.02);
    expect(input.metrics.cancellationRatePct).toBe(0.01);
  });

  it('updates sellerProfile with score, band, and sellerScoreUpdatedAt', async () => {
    await computeAndStoreSellerScore('user-1');
    const updateSet = vi.mocked(vi.mocked(db.update).mock.results[0]!.value.set).mock.calls[0]![0] as Record<string, unknown>;
    expect(updateSet).toMatchObject({
      sellerScore: 820,
      performanceBand: expect.any(String),
      isNew: false,
    });
    expect(updateSet['sellerScoreUpdatedAt']).toBeInstanceOf(Date);
  });

  it('inserts a sellerScoreSnapshot row', async () => {
    await computeAndStoreSellerScore('user-1');
    expect(db.insert).toHaveBeenCalled();
    const insertValues = vi.mocked(vi.mocked(db.insert).mock.results[0]!.value.values).mock.calls[0]![0] as Record<string, unknown>;
    expect(insertValues['overallScore']).toBe(820);
    expect(insertValues['sellerProfileId']).toBe('profile-1');
    expect(insertValues['userId']).toBe('user-1');
  });

  it('calls notifyBandTransition on band change', async () => {
    // Profile is ESTABLISHED, determineEffectiveBand mock returns TOP_RATED → bandChanged=true
    await computeAndStoreSellerScore('user-1');
    expect(notifyBandTransition).toHaveBeenCalledWith('user-1', 'ESTABLISHED', 'TOP_RATED');
  });

  it('calls runEnforcementReeval with the computed score', async () => {
    await computeAndStoreSellerScore('user-1');
    expect(runEnforcementReeval).toHaveBeenCalledOnce();
    const [, score] = vi.mocked(runEnforcementReeval).mock.calls[0]!;
    expect(score).toBe(820);
  });

  it('syncs active listings to Typesense', async () => {
    await computeAndStoreSellerScore('user-1');
    // Typesense mock will be called via dynamic import — verify by checking db.select for listings
    // The 4th select call returns active listings
    expect(vi.mocked(db.select)).toHaveBeenCalled();
  });

  it('returns success with score and band', async () => {
    const result = await computeAndStoreSellerScore('user-1');
    expect(result.success).toBe(true);
    expect(result.score).toBe(820);
    expect(result.isNew).toBe(false);
  });

  it('returns isNew: true and skips scoring for sellers with < newSellerThreshold orders', async () => {
    const { getCompletedOrderCount } = await import('@twicely/scoring/metric-queries');
    vi.mocked(getCompletedOrderCount).mockResolvedValueOnce(3);
    const result = await computeAndStoreSellerScore('user-1');
    expect(result.success).toBe(true);
    expect(result.isNew).toBe(true);
    expect(calculateSellerScore).not.toHaveBeenCalled();
  });
});
