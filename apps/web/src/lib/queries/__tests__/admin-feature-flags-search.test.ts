/**
 * Tests for feature flag search/filter capability (I16)
 * Covers getPartitionedFlags with searchTerm parameter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  featureFlag: { key: 'key', id: 'id', name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  ilike: vi.fn((col, val) => ({ type: 'ilike', col, val })),
  or: vi.fn((...args) => ({ type: 'or', args })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeFlagRow(key: string, name: string, enabled = true) {
  return {
    id: `flag-${key}`,
    key,
    name,
    description: null,
    type: 'BOOLEAN' as const,
    enabled,
    percentage: null,
    targetingJson: {},
    createdByStaffId: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(rows);
  ['from', 'where'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['orderBy'] = terminal;
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getPartitionedFlags with search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns all flags when search term is empty', async () => {
    const rows = [
      makeFlagRow('feature.dark-mode', 'Dark Mode'),
      makeFlagRow('kill.checkout', 'Kill Checkout'),
      makeFlagRow('gate.marketplace', 'Marketplace Gate'),
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getPartitionedFlags } = await import('../admin-feature-flags');
    const result = await getPartitionedFlags();
    const total = result.killSwitches.length + result.launchGates.length + result.regularFlags.length;
    expect(total).toBe(3);
  });

  it('partitions filtered flags into kill/launch/regular', async () => {
    const rows = [
      makeFlagRow('kill.checkout', 'Kill Checkout'),
      makeFlagRow('gate.marketplace', 'Marketplace Gate'),
      makeFlagRow('feature.dark-mode', 'Dark Mode'),
    ];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getPartitionedFlags } = await import('../admin-feature-flags');
    const { killSwitches, launchGates, regularFlags } = await getPartitionedFlags('mode');
    expect(killSwitches).toHaveLength(1);
    expect(launchGates).toHaveLength(1);
    expect(regularFlags).toHaveLength(1);
  });

  it('returns empty partitions when no flags match search', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));
    const { getPartitionedFlags } = await import('../admin-feature-flags');
    const { killSwitches, launchGates, regularFlags } = await getPartitionedFlags('nonexistent-term');
    expect(killSwitches).toHaveLength(0);
    expect(launchGates).toHaveLength(0);
    expect(regularFlags).toHaveLength(0);
  });

  it('search does not affect partition classification', async () => {
    const rows = [makeFlagRow('kill.special-feature', 'Kill Special Feature')];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getPartitionedFlags } = await import('../admin-feature-flags');
    const { killSwitches, regularFlags } = await getPartitionedFlags('special');
    expect(killSwitches).toHaveLength(1);
    expect(killSwitches[0]?.key).toBe('kill.special-feature');
    expect(regularFlags).toHaveLength(0);
  });

  it('filters flags by search term on key (case insensitive via ilike)', async () => {
    const rows = [makeFlagRow('feature.dark-mode', 'Dark Mode')];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getFeatureFlags } = await import('../admin-feature-flags');
    const result = await getFeatureFlags('dark');
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe('feature.dark-mode');
  });

  it('filters flags by search term on name (case insensitive)', async () => {
    const rows = [makeFlagRow('feature.dark-mode', 'Dark Mode')];
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { getFeatureFlags } = await import('../admin-feature-flags');
    const result = await getFeatureFlags('Dark');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Dark Mode');
  });
});
