/**
 * Admin Feature Flag Queries Tests (G10.4)
 * Covers getPartitionedFlags, getFeatureFlags, getFeatureFlagById,
 * and getFeatureFlagByKey partition and mapping logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPartitionedFlags,
  getFeatureFlags,
  getFeatureFlagById,
  getFeatureFlagByKey,
} from '../admin-feature-flags';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  featureFlag: { key: 'key', id: 'id' },
}));
vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  asc: (_col: unknown) => ({ type: 'asc' }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeDbRow(key: string, enabled: boolean) {
  return {
    id: `flag-${key}`,
    key,
    name: `Flag ${key}`,
    description: `Description for ${key}`,
    type: 'BOOLEAN' as const,
    enabled,
    percentage: null,
    targetingJson: {},
    createdByStaffId: 'staff-seed-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function chainSelectOrderBy(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain['orderBy'] = vi.fn().mockResolvedValue(result);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  return chain;
}

// ─── Mixed DB rows ────────────────────────────────────────────────────────────

const MIXED_DB_ROWS = [
  makeDbRow('feature.newSearch', true),
  makeDbRow('gate.marketplace', false),
  makeDbRow('gate.local', true),
  makeDbRow('kill.checkout', true),
  makeDbRow('kill.payouts', false),
  makeDbRow('feature.darkMode', false),
];

// ─── getPartitionedFlags ──────────────────────────────────────────────────────

describe('getPartitionedFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('partitions kill.* flags into killSwitches', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    const { killSwitches } = await getPartitionedFlags();

    expect(killSwitches).toHaveLength(2);
    expect(killSwitches.every((r) => r.key.startsWith('kill.'))).toBe(true);
  });

  it('partitions gate.* flags into launchGates', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    const { launchGates } = await getPartitionedFlags();

    expect(launchGates).toHaveLength(2);
    expect(launchGates.every((r) => r.key.startsWith('gate.'))).toBe(true);
  });

  it('partitions remaining flags into regularFlags', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    const { regularFlags } = await getPartitionedFlags();

    expect(regularFlags).toHaveLength(2);
    expect(regularFlags.every((r) => !r.key.startsWith('kill.'))).toBe(true);
    expect(regularFlags.every((r) => !r.key.startsWith('gate.'))).toBe(true);
  });

  it('kill switches preserve enabled state (true/false)', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    const { killSwitches } = await getPartitionedFlags();

    const checkout = killSwitches.find((r) => r.key === 'kill.checkout');
    const payouts = killSwitches.find((r) => r.key === 'kill.payouts');
    expect(checkout?.enabled).toBe(true);
    expect(payouts?.enabled).toBe(false);
  });

  it('launch gates preserve enabled state', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    const { launchGates } = await getPartitionedFlags();

    const marketplace = launchGates.find((r) => r.key === 'gate.marketplace');
    const local = launchGates.find((r) => r.key === 'gate.local');
    expect(marketplace?.enabled).toBe(false);
    expect(local?.enabled).toBe(true);
  });

  it('returns empty arrays when DB has no flags', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy([]));

    const { killSwitches, launchGates, regularFlags } = await getPartitionedFlags();

    expect(killSwitches).toHaveLength(0);
    expect(launchGates).toHaveLength(0);
    expect(regularFlags).toHaveLength(0);
  });

  it('uses a single DB query (not 3 separate queries)', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    await getPartitionedFlags();

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('flag with feature.newSearch key goes into regularFlags not kill or gate', async () => {
    const rows = [makeDbRow('feature.newSearch', true)];
    mockDbSelect.mockReturnValue(chainSelectOrderBy(rows));

    const { killSwitches, launchGates, regularFlags } = await getPartitionedFlags();

    expect(killSwitches).toHaveLength(0);
    expect(launchGates).toHaveLength(0);
    expect(regularFlags).toHaveLength(1);
    expect(regularFlags[0]?.key).toBe('feature.newSearch');
  });
});

// ─── getFeatureFlags ──────────────────────────────────────────────────────────

describe('getFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all flags mapped through toRow', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy(MIXED_DB_ROWS));

    const result = await getFeatureFlags();

    expect(result).toHaveLength(6);
  });

  it('maps description null to null', async () => {
    const row = { ...makeDbRow('kill.checkout', true), description: null };
    mockDbSelect.mockReturnValue(chainSelectOrderBy([row]));

    const result = await getFeatureFlags();

    expect(result[0]?.description).toBeNull();
  });

  it('maps percentage null to null', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy([makeDbRow('kill.checkout', true)]));

    const result = await getFeatureFlags();

    expect(result[0]?.percentage).toBeNull();
  });
});

// ─── getFeatureFlagById ───────────────────────────────────────────────────────

describe('getFeatureFlagById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped flag row when found', async () => {
    const row = makeDbRow('kill.checkout', true);
    mockDbSelect.mockReturnValue(chainSelectOrderBy([row]));

    const result = await getFeatureFlagById('flag-kill.checkout');

    expect(result).not.toBeNull();
    expect(result?.key).toBe('kill.checkout');
    expect(result?.enabled).toBe(true);
  });

  it('returns null when flag not found', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy([]));

    const result = await getFeatureFlagById('nonexistent-id');

    expect(result).toBeNull();
  });
});

// ─── getFeatureFlagByKey ──────────────────────────────────────────────────────

describe('getFeatureFlagByKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped flag row when found', async () => {
    const row = makeDbRow('gate.marketplace', false);
    mockDbSelect.mockReturnValue(chainSelectOrderBy([row]));

    const result = await getFeatureFlagByKey('gate.marketplace');

    expect(result).not.toBeNull();
    expect(result?.key).toBe('gate.marketplace');
    expect(result?.enabled).toBe(false);
  });

  it('returns null when key not found', async () => {
    mockDbSelect.mockReturnValue(chainSelectOrderBy([]));

    const result = await getFeatureFlagByKey('nonexistent.key');

    expect(result).toBeNull();
  });
});
