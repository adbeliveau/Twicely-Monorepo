/**
 * Feature Flag Service — Evaluation Edge Cases (G10.4)
 * Covers PERCENTAGE and TARGETED evaluation edge cases
 * not addressed by the primary feature-flags.test.ts file.
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

// ─── DB chain helper ──────────────────────────────────────────────────────────

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

// ─── PERCENTAGE type — edge cases ────────────────────────────────────────────

describe('isFeatureEnabled — PERCENTAGE edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('returns false for PERCENTAGE flag when no userId provided', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'PERCENTAGE', percentage: 100, targetingJson: {},
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    // Even 100% rollout — no userId means cannot evaluate bucket
    const result = await isFeatureEnabled('pct.feature');

    expect(result).toBe(false);
  });

  it('returns false for PERCENTAGE flag at 0%', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true, type: 'PERCENTAGE', percentage: 0, targetingJson: {},
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    // bucket is 0-99; 0% means nobody qualifies
    const result = await isFeatureEnabled('pct.zero', { userId: 'user-abc' });

    expect(result).toBe(false);
  });

  it('returns deterministic result for same userId across calls', async () => {
    const flag = { enabled: true, type: 'PERCENTAGE', percentage: 50, targetingJson: {} };
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([flag]));

    const { isFeatureEnabled } = await import('../feature-flags');
    const r1 = await isFeatureEnabled('pct.feature', { userId: 'user-deterministic' });

    vi.clearAllMocks();
    vi.resetModules();
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([flag]));
    mockGetPlatformSetting.mockResolvedValue(30);

    const { isFeatureEnabled: isFeatureEnabled2 } = await import('../feature-flags');
    const r2 = await isFeatureEnabled2('pct.feature', { userId: 'user-deterministic' });

    expect(r1).toBe(r2);
  });
});

// ─── TARGETED type — fallback behavior ───────────────────────────────────────

describe('isFeatureEnabled — TARGETED type fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockResolvedValue(30);
  });

  it('falls back to enabled when userId has no override entry', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true,
      type: 'TARGETED',
      percentage: null,
      targetingJson: { userOverrides: { 'other-user': true } },
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    // user-nobody has no override, fallback is enabled=true
    const result = await isFeatureEnabled('targeted.feature', { userId: 'user-nobody' });

    expect(result).toBe(true);
  });

  it('falls back to enabled=false when userId has no override and flag disabled', async () => {
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: false,
      type: 'TARGETED',
      percentage: null,
      targetingJson: { userOverrides: { 'other-user': true } },
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    const result = await isFeatureEnabled('targeted.feature', { userId: 'user-nobody' });

    expect(result).toBe(false);
  });

  it('returns enabled value when TARGETED flag has no userId in context', async () => {
    // No userId → no override lookup → fallback to payload.enabled
    mockValkeyGet.mockResolvedValue(null);
    mockDbSelect.mockReturnValue(chainSelect([{
      enabled: true,
      type: 'TARGETED',
      percentage: null,
      targetingJson: { userOverrides: { 'user-x': false } },
    }]));

    const { isFeatureEnabled } = await import('../feature-flags');
    // No userId, TARGETED type falls through to return payload.enabled
    const result = await isFeatureEnabled('targeted.feature');

    expect(result).toBe(true); // falls back to enabled=true
  });
});
