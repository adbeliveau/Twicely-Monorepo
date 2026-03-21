/**
 * Supplemental tests for seller-score-recalc-helpers.ts — enforcement + notifications (G4.1).
 * Covers: runAutoEnforcement, notifyBandTransition, loadEnforcementSettings.
 * See seller-score-recalc-helpers.test.ts for determineEffectiveBand.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SellerRow } from '../seller-score-recalc-helpers';

// ── DB mock ──────────────────────────────────────────────────────────────────
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());

vi.mock('@twicely/db', () => ({
  db: {
    update: mockDbUpdate,
    insert: mockDbInsert,
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    userId: 'user_id', enforcementLevel: 'enforcement_level',
    enforcementStartedAt: 'enforcement_started_at', warningExpiresAt: 'warning_expires_at',
    bandOverride: 'band_override', bandOverrideExpiresAt: 'band_override_expires_at',
    bandOverrideReason: 'band_override_reason', bandOverrideBy: 'band_override_by',
    performanceBand: 'performance_band',
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

const mockNotify = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));

// ── Chain helpers ─────────────────────────────────────────────────────────────
function makeUpdateChain() {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };
  mockDbUpdate.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain = { values: vi.fn().mockResolvedValue(undefined) };
  mockDbInsert.mockReturnValue(chain);
  return chain;
}

function makeSellerRow(overrides?: Partial<SellerRow>): SellerRow {
  return {
    id: 'sp-test-2', userId: 'user-test-2', status: 'ACTIVE',
    performanceBand: 'EMERGING' as const,
    enforcementLevel: null, warningExpiresAt: null, bandOverride: null,
    bandOverrideExpiresAt: null, sellerScore: 500, ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  makeUpdateChain();
  makeInsertChain();
});

// ── runAutoEnforcement — threshold transitions ────────────────────────────────

describe('runAutoEnforcement — threshold transitions', () => {
  it('sets COACHING when score is in 400-549 range', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 500, 30, 550, 400, 250, 100);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementLevel: 'COACHING' }),
    );
    expect(mockNotify).toHaveBeenCalledWith('user-test-2', 'enforcement.coaching', expect.any(Object));
  });

  it('sets WARNING when score is in 250-399 range', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 350, 30, 550, 400, 250, 100);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementLevel: 'WARNING' }),
    );
    expect(mockNotify).toHaveBeenCalledWith('user-test-2', 'enforcement.warning', expect.any(Object));
  });

  it('sets warningExpiresAt ~30 days in the future when transitioning to WARNING', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    const before = Date.now();
    await runAutoEnforcement(seller, 350, 30, 550, 400, 250, 100);
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    const expiresAt = setArg?.['warningExpiresAt'] as Date;
    expect(expiresAt).toBeInstanceOf(Date);
    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAt.getTime() - expected)).toBeLessThan(5000);
  });

  it('sets RESTRICTION when score is in 100-249 range', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 200, 30, 550, 400, 250, 100);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementLevel: 'RESTRICTION' }),
    );
    expect(mockNotify).toHaveBeenCalledWith('user-test-2', 'enforcement.restriction', expect.any(Object));
  });

  it('sets PRE_SUSPENSION when score is below 100', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 50, 30, 550, 400, 250, 100);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementLevel: 'PRE_SUSPENSION' }),
    );
    // PRE_SUSPENSION has no template map entry — no enforcement.pre_suspension notification
    expect(mockNotify).not.toHaveBeenCalledWith(
      'user-test-2', expect.stringContaining('pre_suspension'), expect.any(Object),
    );
  });

  it('is a no-op when enforcement level is already the correct level', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const seller = makeSellerRow({ enforcementLevel: 'COACHING' });
    await runAutoEnforcement(seller, 500, 30, 550, 400, 250, 100);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('clears enforcement when score rises above all thresholds', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    const seller = makeSellerRow({ enforcementLevel: 'COACHING' });
    await runAutoEnforcement(seller, 700, 30, 550, 400, 250, 100);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ enforcementLevel: null }),
    );
    expect(mockNotify).toHaveBeenCalledWith('user-test-2', 'enforcement.lifted', {});
  });

  it('inserts enforcement action record with correct type and trigger', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    makeUpdateChain();
    const insertChain = makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 300, 30, 550, 400, 250, 100);
    expect(mockDbInsert).toHaveBeenCalled();
    const inserted = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted?.['actionType']).toBe('WARNING');
    expect(inserted?.['trigger']).toBe('SCORE_BASED');
  });

  it('does NOT insert enforcement action when clearing (null new level)', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    makeUpdateChain();
    const seller = makeSellerRow({ enforcementLevel: 'RESTRICTION' });
    await runAutoEnforcement(seller, 800, 30, 550, 400, 250, 100);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('exact boundary: score 99 (< 100) → PRE_SUSPENSION', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 99, 30, 550, 400, 250, 100);
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.['enforcementLevel']).toBe('PRE_SUSPENSION');
  });

  it('exact boundary: score 100 → RESTRICTION (not PRE_SUSPENSION)', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: null });
    await runAutoEnforcement(seller, 100, 30, 550, 400, 250, 100);
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.['enforcementLevel']).toBe('RESTRICTION');
  });

  it('transition from RESTRICTION to WARNING when score improves to 250-399', async () => {
    const { runAutoEnforcement } = await import('../seller-score-recalc-helpers');
    const updateChain = makeUpdateChain();
    makeInsertChain();
    const seller = makeSellerRow({ enforcementLevel: 'RESTRICTION' });
    await runAutoEnforcement(seller, 350, 30, 550, 400, 250, 100);
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.['enforcementLevel']).toBe('WARNING');
  });
});

// ── notifyBandTransition ──────────────────────────────────────────────────────

describe('notifyBandTransition', () => {
  it('sends band_upgrade for EMERGING → TOP_RATED with bandName "Top Rated"', async () => {
    const { notifyBandTransition } = await import('../seller-score-recalc-helpers');
    await notifyBandTransition('user-test-2', 'EMERGING', 'TOP_RATED');
    expect(mockNotify).toHaveBeenCalledWith(
      'user-test-2', 'enforcement.band_upgrade',
      expect.objectContaining({ bandName: 'Top Rated' }),
    );
  });

  it('sends band_upgrade for TOP_RATED → POWER_SELLER with bandName "Power Seller"', async () => {
    const { notifyBandTransition } = await import('../seller-score-recalc-helpers');
    await notifyBandTransition('user-test-2', 'TOP_RATED', 'POWER_SELLER');
    expect(mockNotify).toHaveBeenCalledWith(
      'user-test-2', 'enforcement.band_upgrade',
      expect.objectContaining({ bandName: 'Power Seller' }),
    );
  });

  it('sends band_downgrade for TOP_RATED → ESTABLISHED with correct band names', async () => {
    const { notifyBandTransition } = await import('../seller-score-recalc-helpers');
    await notifyBandTransition('user-test-2', 'TOP_RATED', 'ESTABLISHED');
    expect(mockNotify).toHaveBeenCalledWith(
      'user-test-2', 'enforcement.band_downgrade',
      expect.objectContaining({ previousBand: 'Top Rated', newBand: 'Established' }),
    );
  });

  it('sends band_downgrade for POWER_SELLER → EMERGING', async () => {
    const { notifyBandTransition } = await import('../seller-score-recalc-helpers');
    await notifyBandTransition('user-test-2', 'POWER_SELLER', 'EMERGING');
    expect(mockNotify).toHaveBeenCalledWith(
      'user-test-2', 'enforcement.band_downgrade',
      expect.objectContaining({ previousBand: 'Power Seller', newBand: 'Emerging' }),
    );
  });
});

// ── loadEnforcementSettings ───────────────────────────────────────────────────

describe('loadEnforcementSettings', () => {
  it('returns default values from platform settings fallbacks', async () => {
    const { loadEnforcementSettings } = await import('../seller-score-recalc-helpers');
    const settings = await loadEnforcementSettings();
    expect(settings.warningDurationDays).toBe(30);
    expect(settings.coachingBelow).toBe(550);
    expect(settings.warningBelow).toBe(400);
    expect(settings.restrictionBelow).toBe(250);
    expect(settings.preSuspensionBelow).toBe(100);
  });

  it('returns all 5 values as numbers', async () => {
    const { loadEnforcementSettings } = await import('../seller-score-recalc-helpers');
    const settings = await loadEnforcementSettings();
    expect(Object.keys(settings)).toHaveLength(5);
    for (const val of Object.values(settings)) {
      expect(typeof val).toBe('number');
    }
  });
});
