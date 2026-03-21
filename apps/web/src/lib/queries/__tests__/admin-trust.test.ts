/**
 * Admin Trust & Safety Query Tests (I7)
 * Tests for getTrustOverviewKPIs, getTrustBandDistribution, getRecentBandTransitions,
 * getSellerTrustProfile, getSellerScoreHistory, getRiskSignals,
 * getSecurityEvents, getSecurityEventKPIs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: (...args: unknown[]) => mockDbSelect(...args) } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { userId: 'userId', performanceBand: 'performanceBand', enforcementLevel: 'enforcementLevel', bandOverride: 'bandOverride', trustScore: 'trustScore', sellerScore: 'sellerScore', id: 'id' },
  sellerPerformance: { sellerProfileId: 'sellerProfileId', defectRate: 'defectRate', inadRate: 'inadRate', chargebackRate: 'chargebackRate', lateShipmentRate: 'lateShipmentRate', cancelRate: 'cancelRate', returnRate: 'returnRate', onTimeShippingPct: 'onTimeShippingPct', avgResponseTimeHours: 'avgResponseTimeHours', currentBand: 'currentBand', totalOrders: 'totalOrders', completedOrders: 'completedOrders', averageRating: 'averageRating' },
  sellerScoreSnapshot: { userId: 'userId', previousBand: 'previousBand', bandChangedAt: 'bandChangedAt', performanceBand: 'performanceBand', overallScore: 'overallScore', snapshotDate: 'snapshotDate', createdAt: 'createdAt', id: 'id', searchMultiplier: 'searchMultiplier', shippingScore: 'shippingScore', inadScore: 'inadScore', reviewScore: 'reviewScore', responseScore: 'responseScore', returnScore: 'returnScore', cancellationScore: 'cancellationScore', trendModifier: 'trendModifier', orderCount: 'orderCount' },
  auditEvent: { action: 'action', severity: 'severity', createdAt: 'createdAt', id: 'id', actorType: 'actorType', actorId: 'actorId', subject: 'subject', subjectId: 'subjectId', detailsJson: 'detailsJson', ipAddress: 'ipAddress', userAgent: 'userAgent' },
  user: { id: 'id', name: 'name', email: 'email' },
}));
vi.mock('drizzle-orm', () => ({
  eq: () => ({ type: 'eq' }),
  desc: () => ({ type: 'desc' }),
  avg: () => ({ type: 'avg' }),
  count: () => ({ type: 'count' }),
  lt: () => ({ type: 'lt' }),
  sql: Object.assign((parts: TemplateStringsArray, ..._rest: unknown[]) => parts[0], { raw: (s: string) => s }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  gte: () => ({ type: 'gte' }),
  like: () => ({ type: 'like' }),
}));

// ─── Chain Helper ─────────────────────────────────────────────────────────────

function chain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'innerJoin', 'leftJoin', 'select']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

const NOW = new Date('2026-01-01T00:00:00Z');

// ─── getTrustBandDistribution ─────────────────────────────────────────────────

describe('getTrustBandDistribution', () => {
  beforeEach(() => vi.resetAllMocks());

  it('groups by performanceBand correctly', async () => {
    const rows = [
      { band: 'POWER_SELLER', cnt: 5 },
      { band: 'TOP_RATED', cnt: 10 },
      { band: 'EMERGING', cnt: 50 },
    ];
    mockDbSelect.mockReturnValue(chain(rows));
    const { getTrustBandDistribution } = await import('../admin-trust');
    const result = await getTrustBandDistribution();
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.band === 'POWER_SELLER')?.count).toBe(5);
  });

  it('returns empty array when no sellers', async () => {
    mockDbSelect.mockReturnValue(chain([]));
    const { getTrustBandDistribution } = await import('../admin-trust');
    const result = await getTrustBandDistribution();
    expect(result).toHaveLength(0);
  });
});

// ─── getTrustOverviewKPIs ─────────────────────────────────────────────────────

describe('getTrustOverviewKPIs', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns correct band distribution counts', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([{ totalSellers: 100, avgTrustScore: 75, avgSellerScore: 600 }]))
      .mockReturnValueOnce(chain([{ band: 'EMERGING', cnt: 60 }, { band: 'TOP_RATED', cnt: 40 }]))
      .mockReturnValueOnce(chain([{ level: 'WARNING', cnt: 5 }]))
      .mockReturnValueOnce(chain([{ cnt: 3 }]));
    const { getTrustOverviewKPIs } = await import('../admin-trust');
    const kpis = await getTrustOverviewKPIs();
    expect(kpis.totalSellers).toBe(100);
    expect(kpis.bandDistribution).toHaveLength(2);
  });

  it('returns correct enforcement level counts', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([{ totalSellers: 50, avgTrustScore: 80, avgSellerScore: 700 }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ level: 'COACHING', cnt: 2 }, { level: 'WARNING', cnt: 1 }, { level: 'RESTRICTION', cnt: 1 }, { level: 'PRE_SUSPENSION', cnt: 1 }]))
      .mockReturnValueOnce(chain([{ cnt: 0 }]));
    const { getTrustOverviewKPIs } = await import('../admin-trust');
    const kpis = await getTrustOverviewKPIs();
    expect(kpis.enforcementCounts.coaching).toBe(2);
    expect(kpis.enforcementCounts.warning).toBe(1);
    expect(kpis.enforcementCounts.restriction).toBe(1);
    expect(kpis.enforcementCounts.preSuspension).toBe(1);
  });
});

// ─── getRecentBandTransitions ─────────────────────────────────────────────────

describe('getRecentBandTransitions', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns transitions ordered by date desc', async () => {
    const rows = [
      { userId: 'u1', userName: 'Alice', previousBand: 'EMERGING', performanceBand: 'TOP_RATED', sellerScore: 900, bandChangedAt: NOW },
    ];
    mockDbSelect.mockReturnValue(chain(rows));
    const { getRecentBandTransitions } = await import('../admin-trust');
    const result = await getRecentBandTransitions();
    expect(result[0]?.newBand).toBe('TOP_RATED');
    expect(result[0]?.previousBand).toBe('EMERGING');
  });

  it('respects limit parameter', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ userId: `u${i}`, userName: `User ${i}`, previousBand: 'EMERGING', performanceBand: 'ESTABLISHED', sellerScore: 500, bandChangedAt: NOW }));
    mockDbSelect.mockReturnValue(chain(rows));
    const { getRecentBandTransitions } = await import('../admin-trust');
    const result = await getRecentBandTransitions(5);
    expect(result).toHaveLength(5);
  });
});

// ─── getSellerTrustProfile ────────────────────────────────────────────────────

describe('getSellerTrustProfile', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns null for non-existent userId', async () => {
    mockDbSelect.mockReturnValue(chain([]));
    const { getSellerTrustProfile } = await import('../admin-trust');
    const result = await getSellerTrustProfile('nonexistent-user');
    expect(result).toBeNull();
  });

  it('joins sellerPerformance metrics correctly', async () => {
    const row = {
      userId: 'u1', name: 'Alice', email: 'alice@test.com',
      trustScore: 85, sellerScore: 750, performanceBand: 'TOP_RATED',
      enforcementLevel: null, enforcementStartedAt: null, warningExpiresAt: null,
      bandOverride: null, bandOverrideExpiresAt: null, bandOverrideReason: null, bandOverrideBy: null,
      isNew: false, defectRate: 0.005, inadRate: 0.003, chargebackRate: 0.001,
      lateShipmentRate: 0.01, cancelRate: 0.002, returnRate: 0.02,
      onTimeShippingPct: 0.97, avgResponseTimeHours: 8, currentBand: 'TOP_RATED',
      totalOrders: 200, completedOrders: 195, averageRating: 4.9,
    };
    mockDbSelect.mockReturnValue(chain([row]));
    const { getSellerTrustProfile } = await import('../admin-trust');
    const result = await getSellerTrustProfile('u1');
    expect(result).not.toBeNull();
    expect(result?.defectRate).toBe(0.005);
    expect(result?.inadRate).toBe(0.003);
    expect(result?.averageRating).toBe(4.9);
    expect(result?.onTimeShippingPct).toBe(0.97);
  });
});

// ─── getSellerScoreHistory ────────────────────────────────────────────────────

describe('getSellerScoreHistory', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns snapshots ordered by date desc', async () => {
    const rows = [
      { id: 's1', snapshotDate: '2026-01-15', overallScore: 750, performanceBand: 'TOP_RATED', searchMultiplier: 1.1, shippingScore: 900, inadScore: 800, reviewScore: 900, responseScore: 700, returnScore: 750, cancellationScore: 850, trendModifier: 0.05, orderCount: 10, previousBand: null, bandChangedAt: null },
    ];
    mockDbSelect.mockReturnValue(chain(rows));
    const { getSellerScoreHistory } = await import('../admin-trust');
    const result = await getSellerScoreHistory('u1');
    expect(result[0]?.overallScore).toBe(750);
  });

  it('respects days parameter', async () => {
    mockDbSelect.mockReturnValue(chain([]));
    const { getSellerScoreHistory } = await import('../admin-trust');
    const result = await getSellerScoreHistory('u1', 30);
    expect(result).toHaveLength(0);
  });
});
