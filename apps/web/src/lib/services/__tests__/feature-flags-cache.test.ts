/**
 * Feature Flag Cache Layer Tests (G10.4)
 * Covers Valkey cache key format, TTL, invalidation, and concurrency behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };
vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  featureFlag: { key: 'key' },
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

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

// ─── Cache key format ─────────────────────────────────────────────────────────

describe('Cache key format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('uses ff:{flagKey} pattern for cache keys', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    await isFeatureEnabled('my.feature');

    expect(mockValkeyGet).toHaveBeenCalledWith('ff:my.feature');
  });

  it('uses ff:kill.{key} pattern for kill switches', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isKillSwitchActive } = await import('../feature-flags');
    await isKillSwitchActive('checkout');

    expect(mockValkeyGet).toHaveBeenCalledWith('ff:kill.checkout');
  });

  it('uses ff:gate.{key} pattern for launch gates', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isLaunchGateOpen } = await import('../feature-flags');
    await isLaunchGateOpen('marketplace');

    expect(mockValkeyGet).toHaveBeenCalledWith('ff:gate.marketplace');
  });
});

// ─── Cache TTL ────────────────────────────────────────────────────────────────

describe('Cache TTL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads TTL from featureFlags.cacheSeconds platform setting', async () => {
    mockGetPlatformSetting.mockResolvedValue(60);
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    await isFeatureEnabled('test.flag');

    // Wait for fire-and-forget cache write
    await new Promise((r) => setTimeout(r, 10));
    expect(mockGetPlatformSetting).toHaveBeenCalledWith('featureFlags.cacheSeconds', 30);
  });

  it('bypasses cache write when TTL is 0', async () => {
    mockGetPlatformSetting.mockResolvedValue(0);
    mockValkeyGet.mockResolvedValue(null);
    mockValkeySet.mockResolvedValue('OK');
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    await isFeatureEnabled('test.flag');

    await new Promise((r) => setTimeout(r, 10));
    expect(mockValkeySet).not.toHaveBeenCalled();
  });
});

// ─── Cache invalidation ───────────────────────────────────────────────────────

describe('Cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('invalidateFlagCache deletes the ff:{flagKey} key', async () => {
    mockValkeyDel.mockResolvedValue(1);

    const { invalidateFlagCache } = await import('../feature-flags');
    await invalidateFlagCache('kill.checkout');

    expect(mockValkeyDel).toHaveBeenCalledWith('ff:kill.checkout');
  });

  it('invalidateFlagCache does not throw when Valkey is unavailable', async () => {
    mockValkeyDel.mockRejectedValue(new Error('Connection refused'));

    const { invalidateFlagCache } = await import('../feature-flags');
    await expect(invalidateFlagCache('test.flag')).resolves.toBeUndefined();
  });
});

// ─── Concurrent cache reads ───────────────────────────────────────────────────

describe('Concurrent cache reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('returns consistent results for concurrent reads of same cached flag', async () => {
    const cachedPayload = JSON.stringify({
      enabled: true, type: 'BOOLEAN', percentage: null, targetingJson: {},
    });
    mockValkeyGet.mockResolvedValue(cachedPayload);

    const { isFeatureEnabled } = await import('../feature-flags');
    const results = await Promise.all([
      isFeatureEnabled('test.concurrent'),
      isFeatureEnabled('test.concurrent'),
      isFeatureEnabled('test.concurrent'),
    ]);

    expect(results).toEqual([true, true, true]);
  });
});
