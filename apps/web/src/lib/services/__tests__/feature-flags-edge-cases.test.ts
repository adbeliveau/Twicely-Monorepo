/**
 * Feature Flag Service — Valkey Error Handling Edge Cases (G10.4)
 * Covers kill switch and launch gate Valkey fallback scenarios,
 * special characters in flag keys, and cacheSeconds=0 bypass.
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

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
}));

// ─── DB chain helpers ─────────────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function chainSelectThrows(message: string) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockRejectedValue(new Error(message)),
  };
}

// ─── isKillSwitchActive — Valkey error handling ───────────────────────────────

describe('isKillSwitchActive — Valkey error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('falls back to DB when Valkey GET throws (connection refused)', async () => {
    mockValkeyGet.mockRejectedValue(new Error('Connection refused'));
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isKillSwitchActive } = await import('../feature-flags');
    const result = await isKillSwitchActive('checkout');

    expect(result).toBe(true);
    expect(mockDbSelect).toHaveBeenCalled();
  });

  it('returns fail-open (true) when Valkey throws AND DB also throws', async () => {
    mockValkeyGet.mockRejectedValue(new Error('Connection refused'));
    mockDbSelect.mockReturnValue(chainSelectThrows('DB connection failed'));

    const { isKillSwitchActive } = await import('../feature-flags');
    const result = await isKillSwitchActive('checkout');

    expect(result).toBe(true); // fail-open: never block a feature on infrastructure failure
  });

  it('returns false when kill switch flag is disabled (Valkey down, DB works)', async () => {
    mockValkeyGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isKillSwitchActive } = await import('../feature-flags');
    const result = await isKillSwitchActive('payouts');

    expect(result).toBe(false);
  });
});

// ─── isLaunchGateOpen — Valkey error handling ────────────────────────────────

describe('isLaunchGateOpen — Valkey error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('falls back to DB when Valkey GET throws (connection refused)', async () => {
    mockValkeyGet.mockRejectedValue(new Error('Connection refused'));
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    const result = await isLaunchGateOpen('marketplace');

    expect(result).toBe(true);
    expect(mockDbSelect).toHaveBeenCalled();
  });

  it('returns fail-closed (false) when Valkey AND DB both throw', async () => {
    mockValkeyGet.mockRejectedValue(new Error('Connection refused'));
    mockDbSelect.mockReturnValue(chainSelectThrows('DB down'));

    const { isLaunchGateOpen } = await import('../feature-flags');
    const result = await isLaunchGateOpen('marketplace');

    expect(result).toBe(false); // fail-closed: don't open an unverified gate
  });

  it('returns true when gate flag is enabled (Valkey down, DB works)', async () => {
    mockValkeyGet.mockRejectedValue(new Error('ECONNREFUSED'));
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    const result = await isLaunchGateOpen('helpdesk');

    expect(result).toBe(true);
  });
});

// ─── Special characters in flag keys ─────────────────────────────────────────

describe('isFeatureEnabled — special characters in key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('uses the full key including dots in Valkey lookup', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    await isFeatureEnabled('kill.listings.create');

    expect(mockValkeyGet).toHaveBeenCalledWith('ff:kill.listings.create');
  });

  it('handles gate key with multiple dots (gate.financial.center)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    await isLaunchGateOpen('financial.center');

    expect(mockValkeyGet).toHaveBeenCalledWith('ff:gate.financial.center');
  });

  it('handles gate key with multiple dots (gate.store.subscriptions)', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    await isLaunchGateOpen('store.subscriptions');

    expect(mockValkeyGet).toHaveBeenCalledWith('ff:gate.store.subscriptions');
  });
});

// ─── cacheSeconds=0 for kill/gate helpers ─────────────────────────────────────

describe('isKillSwitchActive — cacheSeconds=0 bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not write to Valkey cache when cacheSeconds is 0', async () => {
    mockGetPlatformSetting.mockResolvedValue(0);
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isKillSwitchActive } = await import('../feature-flags');
    await isKillSwitchActive('checkout');

    await new Promise((r) => setTimeout(r, 10));
    expect(mockValkeySet).not.toHaveBeenCalled();
  });
});

describe('isLaunchGateOpen — cacheSeconds=0 bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not write to Valkey cache when cacheSeconds is 0', async () => {
    mockGetPlatformSetting.mockResolvedValue(0);
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    await isLaunchGateOpen('marketplace');

    await new Promise((r) => setTimeout(r, 10));
    expect(mockValkeySet).not.toHaveBeenCalled();
  });
});
