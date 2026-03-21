/**
 * Supplemental tests for seller-score-recalc-helpers.ts — determineEffectiveBand (G4.1).
 * Covers: band override, warning lockout, downgrade grace period.
 * See seller-score-recalc-enforcement.test.ts for runAutoEnforcement / notifyBandTransition.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SellerRow } from '../seller-score-recalc-helpers';

// ── DB mock ──────────────────────────────────────────────────────────────────
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbSelect = vi.hoisted(() => vi.fn());

vi.mock('@twicely/db', () => ({
  db: {
    update: mockDbUpdate,
    select: mockDbSelect,
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    userId: 'user_id', performanceBand: 'performance_band',
    enforcementLevel: 'enforcement_level', enforcementStartedAt: 'enforcement_started_at',
    warningExpiresAt: 'warning_expires_at', bandOverride: 'band_override',
    bandOverrideExpiresAt: 'band_override_expires_at', bandOverrideReason: 'band_override_reason',
    bandOverrideBy: 'band_override_by',
  },
  sellerScoreSnapshot: {
    userId: 'user_id', snapshotDate: 'snapshot_date', performanceBand: 'performance_band',
  },
  enforcementAction: { id: 'id' },
}));

const mockGetPlatformSetting = vi.hoisted(() =>
  vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
);

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

// ── Chain helpers ─────────────────────────────────────────────────────────────
function makeUpdateChain() {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };
  mockDbUpdate.mockReturnValue(chain);
  return chain;
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(rows),
  };
  mockDbSelect.mockReturnValue(chain);
  return chain;
}

function makeSellerRow(overrides?: Partial<SellerRow>): SellerRow {
  return {
    id: 'sp-test-1', userId: 'user-test-1', status: 'ACTIVE',
    performanceBand: 'EMERGING' as const,
    enforcementLevel: null, warningExpiresAt: null, bandOverride: null,
    bandOverrideExpiresAt: null, sellerScore: 600, ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  makeUpdateChain();
  makeSelectChain([]);
});

// ── determineEffectiveBand — band override ────────────────────────────────────

describe('determineEffectiveBand — band override', () => {
  it('returns override band when valid override is present', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const future = new Date(Date.now() + 86400000 * 10);
    const seller = makeSellerRow({ bandOverride: 'TOP_RATED', bandOverrideExpiresAt: future });
    const result = await determineEffectiveBand(seller, 'EMERGING', 7);
    expect(result).toBe('TOP_RATED');
  });

  it('clears expired override via DB update', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const past = new Date('2020-01-01');
    const updateChain = makeUpdateChain();
    makeSelectChain([]); // grace period query
    const seller = makeSellerRow({
      bandOverride: 'TOP_RATED', bandOverrideExpiresAt: past, performanceBand: 'TOP_RATED',
    });
    await determineEffectiveBand(seller, 'EMERGING', 1);
    expect(updateChain.set).toHaveBeenCalled();
  });

  it('holds current band when expired override clears but grace not satisfied', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const past = new Date('2020-01-01');
    makeUpdateChain();
    makeSelectChain([]); // 0 rows → grace not satisfied
    const seller = makeSellerRow({
      bandOverride: 'TOP_RATED', bandOverrideExpiresAt: past, performanceBand: 'TOP_RATED',
    });
    const result = await determineEffectiveBand(seller, 'EMERGING', 1);
    expect(result).toBe('TOP_RATED');
  });

  it('ignores SUSPENDED override — returns score-derived band', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const future = new Date(Date.now() + 86400000);
    const seller = makeSellerRow({ bandOverride: 'SUSPENDED', bandOverrideExpiresAt: future });
    const result = await determineEffectiveBand(seller, 'TOP_RATED', 7);
    expect(result).toBe('TOP_RATED');
  });
});

// ── determineEffectiveBand — warning lockout ──────────────────────────────────

describe('determineEffectiveBand — warning lockout', () => {
  it('caps score-derived TOP_RATED to ESTABLISHED (currentBand = EMERGING, no grace)', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const future = new Date(Date.now() + 86400000 * 20);
    const seller = makeSellerRow({
      enforcementLevel: 'WARNING', warningExpiresAt: future, performanceBand: 'EMERGING',
    });
    const result = await determineEffectiveBand(seller, 'TOP_RATED', 7);
    expect(result).toBe('ESTABLISHED');
  });

  it('caps score-derived POWER_SELLER to ESTABLISHED (currentBand = EMERGING)', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const future = new Date(Date.now() + 86400000 * 20);
    const seller = makeSellerRow({
      enforcementLevel: 'WARNING', warningExpiresAt: future, performanceBand: 'EMERGING',
    });
    const result = await determineEffectiveBand(seller, 'POWER_SELLER', 7);
    expect(result).toBe('ESTABLISHED');
  });

  it('does not cap score-derived ESTABLISHED', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const future = new Date(Date.now() + 86400000 * 20);
    const seller = makeSellerRow({
      enforcementLevel: 'WARNING', warningExpiresAt: future, performanceBand: 'EMERGING',
    });
    const result = await determineEffectiveBand(seller, 'ESTABLISHED', 7);
    expect(result).toBe('ESTABLISHED');
  });

  it('allows TOP_RATED when warning has expired', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const past = new Date('2020-01-01');
    const seller = makeSellerRow({
      enforcementLevel: 'WARNING', warningExpiresAt: past, performanceBand: 'TOP_RATED',
    });
    const result = await determineEffectiveBand(seller, 'TOP_RATED', 7);
    expect(result).toBe('TOP_RATED');
  });

  it('warning lockout cap treated as downgrade when currentBand is higher → grace holds it', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const future = new Date(Date.now() + 86400000 * 20);
    makeSelectChain([]); // 0 grace rows → grace not satisfied
    const seller = makeSellerRow({
      enforcementLevel: 'WARNING', warningExpiresAt: future, performanceBand: 'TOP_RATED',
    });
    // warning caps to ESTABLISHED but grace holds currentBand TOP_RATED
    const result = await determineEffectiveBand(seller, 'TOP_RATED', 7);
    expect(result).toBe('TOP_RATED');
  });
});

// ── determineEffectiveBand — downgrade grace period ───────────────────────────

describe('determineEffectiveBand — downgrade grace period', () => {
  it('holds current band when grace rows < graceDays', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    makeSelectChain([
      { performanceBand: 'ESTABLISHED' },
      { performanceBand: 'ESTABLISHED' },
      { performanceBand: 'ESTABLISHED' },
    ]);
    const seller = makeSellerRow({ performanceBand: 'TOP_RATED' });
    const result = await determineEffectiveBand(seller, 'ESTABLISHED', 7);
    expect(result).toBe('TOP_RATED');
  });

  it('applies downgrade when grace rows equal graceDays and all below current band', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    makeSelectChain(Array(7).fill({ performanceBand: 'ESTABLISHED' }));
    const seller = makeSellerRow({ performanceBand: 'TOP_RATED' });
    const result = await determineEffectiveBand(seller, 'ESTABLISHED', 7);
    expect(result).toBe('ESTABLISHED');
  });

  it('holds current band if any grace row is at or above current band', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    makeSelectChain([
      ...Array(6).fill({ performanceBand: 'ESTABLISHED' }),
      { performanceBand: 'TOP_RATED' },
    ]);
    const seller = makeSellerRow({ performanceBand: 'TOP_RATED' });
    const result = await determineEffectiveBand(seller, 'ESTABLISHED', 7);
    expect(result).toBe('TOP_RATED');
  });

  it('bypasses grace for SUSPENDED current band — returns score-derived band', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const seller = makeSellerRow({ performanceBand: 'SUSPENDED' });
    const result = await determineEffectiveBand(seller, 'EMERGING', 7);
    expect(result).toBe('EMERGING');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('upgrade is immediate — no grace period query executed', async () => {
    const { determineEffectiveBand } = await import('../seller-score-recalc-helpers');
    const seller = makeSellerRow({ performanceBand: 'ESTABLISHED' });
    const result = await determineEffectiveBand(seller, 'TOP_RATED', 7);
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(result).toBe('TOP_RATED');
  });
});
