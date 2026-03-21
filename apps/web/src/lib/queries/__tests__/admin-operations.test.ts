/**
 * Admin Operations Query Tests (I11)
 * Covers getOperationsSummary aggregations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOperationsSummary } from '../admin-operations';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  providerInstance: { status: 'status', key: 'key', enabled: 'enabled' },
  featureFlag: { key: 'key', enabled: 'enabled' },
  auditEvent: { severity: 'severity', createdAt: 'created_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  gte: vi.fn((_col: unknown, _val: unknown) => ({ type: 'gte' })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ type: 'inArray' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: 'sql',
    strings,
    values,
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSimpleCountChain(count: number) {
  const result = [{ count }];
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeAggChain(total: number, enabled: number) {
  const result = [{ total, enabled }];
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ─── getOperationsSummary ─────────────────────────────────────────────────────

describe('getOperationsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns provider counts (total, active, inactive)', async () => {
    let callIdx = 0;
    mockDbSelect.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return makeSimpleCountChain(5);  // total providers
      if (callIdx === 2) return makeSimpleCountChain(4);  // active providers
      if (callIdx === 3) return makeSimpleCountChain(2);  // kill switches active
      if (callIdx === 4) return makeSimpleCountChain(1);  // critical events 24h
      return makeAggChain(10, 7);                          // flag counts
    });

    const result = await getOperationsSummary();

    expect(result.providerCounts.total).toBe(5);
    expect(result.providerCounts.active).toBe(4);
    expect(result.providerCounts.inactive).toBe(1);
  });

  it('returns killSwitchActive count', async () => {
    let callIdx = 0;
    mockDbSelect.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return makeSimpleCountChain(3);
      if (callIdx === 2) return makeSimpleCountChain(3);
      if (callIdx === 3) return makeSimpleCountChain(2);  // 2 kill switches active
      if (callIdx === 4) return makeSimpleCountChain(0);
      return makeAggChain(5, 3);
    });

    const result = await getOperationsSummary();

    expect(result.killSwitchActive).toBe(2);
  });

  it('returns criticalEvents24h count', async () => {
    let callIdx = 0;
    mockDbSelect.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return makeSimpleCountChain(1);
      if (callIdx === 2) return makeSimpleCountChain(1);
      if (callIdx === 3) return makeSimpleCountChain(0);
      if (callIdx === 4) return makeSimpleCountChain(7);  // 7 critical events
      return makeAggChain(5, 3);
    });

    const result = await getOperationsSummary();

    expect(result.criticalEvents24h).toBe(7);
  });

  it('returns totalFlags and enabledFlags', async () => {
    let callIdx = 0;
    mockDbSelect.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return makeSimpleCountChain(0);
      if (callIdx === 2) return makeSimpleCountChain(0);
      if (callIdx === 3) return makeSimpleCountChain(0);
      if (callIdx === 4) return makeSimpleCountChain(0);
      return makeAggChain(20, 15);  // 20 total, 15 enabled
    });

    const result = await getOperationsSummary();

    expect(result.totalFlags).toBe(20);
    expect(result.enabledFlags).toBe(15);
  });

  it('handles empty database gracefully', async () => {
    mockDbSelect.mockImplementation(() => makeSimpleCountChain(0));

    const result = await getOperationsSummary();

    expect(result.providerCounts.total).toBe(0);
    expect(result.providerCounts.active).toBe(0);
    expect(result.providerCounts.inactive).toBe(0);
    expect(result.killSwitchActive).toBe(0);
    expect(result.criticalEvents24h).toBe(0);
  });

  it('computes inactive as total minus active', async () => {
    let callIdx = 0;
    mockDbSelect.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) return makeSimpleCountChain(10);
      if (callIdx === 2) return makeSimpleCountChain(6);
      if (callIdx === 3) return makeSimpleCountChain(0);
      if (callIdx === 4) return makeSimpleCountChain(0);
      return makeAggChain(0, 0);
    });

    const result = await getOperationsSummary();

    expect(result.providerCounts.inactive).toBe(4);
  });
});
