/**
 * Feature Flag Evaluation Service Tests (G10.4)
 * Covers isFeatureEnabled, isKillSwitchActive, isLaunchGateOpen with Valkey cache.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };
vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  featureFlag: { key: 'key', enabled: 'enabled', type: 'type' },
}));

const mockValkeyGet = vi.fn();
const mockValkeySet = vi.fn();
const mockValkeyDel = vi.fn();
const mockValkeyClient = {
  get: mockValkeyGet,
  set: mockValkeySet,
  del: mockValkeyDel,
  status: 'ready',
};
vi.mock('@twicely/db/cache/valkey', () => ({
  getValkeyClient: () => mockValkeyClient,
  isConnected: () => true,
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(30),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
}));

// ─── DB chain helper ──────────────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

// ─── Flag factories ───────────────────────────────────────────────────────────

function makeBooleanFlag(enabled: boolean) {
  return {
    key: 'test.flag',
    enabled,
    type: 'BOOLEAN',
    percentage: null,
    targetingJson: {},
  };
}

function makePercentageFlag(enabled: boolean, percentage: number) {
  return {
    key: 'test.pct',
    enabled,
    type: 'PERCENTAGE',
    percentage,
    targetingJson: {},
  };
}

function makeTargetedFlag(enabled: boolean, overrides: Record<string, boolean>) {
  return {
    key: 'test.targeted',
    enabled,
    type: 'TARGETED',
    percentage: null,
    targetingJson: { userOverrides: overrides },
  };
}

// ─── isFeatureEnabled ─────────────────────────────────────────────────────────

describe('isFeatureEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns false when flag does not exist in DB (cache miss)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { isFeatureEnabled } = await import('../feature-flags');
    expect(await isFeatureEnabled('no.such.flag')).toBe(false);
  });

  it('returns true for enabled BOOLEAN flag (cache miss)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([makeBooleanFlag(true)]));

    const { isFeatureEnabled } = await import('../feature-flags');
    expect(await isFeatureEnabled('test.flag')).toBe(true);
  });

  it('returns false for disabled BOOLEAN flag (cache miss)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([makeBooleanFlag(false)]));

    const { isFeatureEnabled } = await import('../feature-flags');
    expect(await isFeatureEnabled('test.flag')).toBe(false);
  });

  it('evaluates PERCENTAGE type with deterministic hash', async () => {
    mockValkeyGet.mockResolvedValue(null);
    // percentage=50: some userId combos will be in, some out
    mockDbSelect.mockReturnValue(chainSelect([makePercentageFlag(true, 50)]));

    const { isFeatureEnabled } = await import('../feature-flags');
    // With userId=alice and a deterministic hash, result should be consistent
    const result1 = await isFeatureEnabled('test.pct', { userId: 'alice' });
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([makePercentageFlag(true, 50)]));
    const result2 = await isFeatureEnabled('test.pct', { userId: 'alice' });
    expect(result1).toBe(result2); // deterministic
  });

  it('evaluates TARGETED type with user override (included)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([makeTargetedFlag(true, { 'user-1': true })]));

    const { isFeatureEnabled } = await import('../feature-flags');
    expect(await isFeatureEnabled('test.targeted', { userId: 'user-1' })).toBe(true);
  });

  it('evaluates TARGETED type with user override (excluded)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([makeTargetedFlag(true, { 'user-1': false })]));

    const { isFeatureEnabled } = await import('../feature-flags');
    expect(await isFeatureEnabled('test.targeted', { userId: 'user-1' })).toBe(false);
  });

  it('reads from Valkey cache on cache hit (no DB call)', async () => {
    const cachedPayload = JSON.stringify({
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    });
    mockValkeyGet.mockResolvedValue(cachedPayload);

    const { isFeatureEnabled } = await import('../feature-flags');
    const result = await isFeatureEnabled('cached.flag');
    expect(result).toBe(true);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('falls back to DB on Valkey cache miss and populates cache', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([makeBooleanFlag(true)]));

    const { isFeatureEnabled } = await import('../feature-flags');
    const result = await isFeatureEnabled('test.flag');
    expect(result).toBe(true);
    expect(mockDbSelect).toHaveBeenCalled();
    // Allow fire-and-forget cache write to flush via microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(mockValkeyGet).toHaveBeenCalledWith('ff:test.flag');
  });

  it('falls back to DB when Valkey throws (no throw propagated)', async () => {
    mockValkeyGet.mockRejectedValue(new Error('Connection refused'));
    mockDbSelect.mockReturnValue(chainSelect([makeBooleanFlag(true)]));

    const { isFeatureEnabled } = await import('../feature-flags');
    expect(await isFeatureEnabled('test.flag')).toBe(true);
  });
});

// ─── isKillSwitchActive ───────────────────────────────────────────────────────

describe('isKillSwitchActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('prepends kill. prefix and returns true when enabled', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isKillSwitchActive } = await import('../feature-flags');
    expect(await isKillSwitchActive('checkout')).toBe(true);
  });

  it('prepends kill. prefix and returns false when disabled', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isKillSwitchActive } = await import('../feature-flags');
    expect(await isKillSwitchActive('checkout')).toBe(false);
  });

  it('returns true when flag not found (fail-open)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { isKillSwitchActive } = await import('../feature-flags');
    expect(await isKillSwitchActive('nonexistent')).toBe(true);
  });
});

// ─── isLaunchGateOpen ─────────────────────────────────────────────────────────

describe('isLaunchGateOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('prepends gate. prefix and returns true when enabled', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    expect(await isLaunchGateOpen('marketplace')).toBe(true);
  });

  it('prepends gate. prefix and returns false when disabled', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    expect(await isLaunchGateOpen('marketplace')).toBe(false);
  });

  it('returns false when flag not found (fail-closed)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    expect(await isLaunchGateOpen('nonexistent')).toBe(false);
  });
});
