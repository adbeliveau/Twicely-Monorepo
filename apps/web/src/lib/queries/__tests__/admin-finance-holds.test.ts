/**
 * Admin Reserve Hold Queries Tests (I3)
 * Covers getHoldList and getHoldStats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHoldList, getHoldStats } from '../admin-finance-holds';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: {
    id: 'id',
    type: 'type',
    amountCents: 'amount_cents',
    userId: 'user_id',
    reversalOfEntryId: 'reversal_of_entry_id',
    createdAt: 'created_at',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  gte: (_col: unknown, _val: unknown) => ({ type: 'gte' }),
  isNull: (_col: unknown) => ({ type: 'isNull' }),
  desc: (_col: unknown) => ({ type: 'desc' }),
  count: () => ({ type: 'count' }),
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql' }),
    { append: vi.fn() }
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'innerJoin', 'leftJoin'].forEach((key) => {
    chain[key] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeHoldEntry(id: string, amountCents: number) {
  return {
    id,
    type: 'RESERVE_HOLD',
    amountCents,
    userId: 'user-1',
    reversalOfEntryId: null,
    createdAt: NOW,
    status: 'POSTED',
    memo: null,
  };
}

function makeReleaseEntry(id: string, reversalOfEntryId: string) {
  return {
    id,
    type: 'RESERVE_RELEASE',
    amountCents: 5000,
    userId: 'user-1',
    reversalOfEntryId,
    createdAt: NOW,
    status: 'POSTED',
    memo: null,
  };
}

// ─── getHoldStats ─────────────────────────────────────────────────────────────

describe('getHoldStats', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns correct active count and total held amount', async () => {
    const holds = [makeHoldEntry('hold-1', -5000), makeHoldEntry('hold-2', -3000)];
    const releases = [{ reversalOfEntryId: 'hold-1' }];

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain(holds))    // allHolds
      .mockReturnValueOnce(makeSelectChain(releases)) // releaseRows
      .mockReturnValueOnce(makeSelectChain([{ total: 1 }])); // released30d count

    const stats = await getHoldStats();

    expect(stats.activeCount).toBe(1); // hold-2 is still active
    expect(stats.totalHeldCents).toBe(3000); // abs(-3000)
  });

  it('returns zero when no holds exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]));

    const stats = await getHoldStats();

    expect(stats.activeCount).toBe(0);
    expect(stats.totalHeldCents).toBe(0);
    expect(stats.released30dCount).toBe(0);
  });
});

// ─── getHoldList (active) ─────────────────────────────────────────────────────

describe('getHoldList - active', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns active holds (RESERVE_HOLD without matching RESERVE_RELEASE)', async () => {
    const holds = [
      makeHoldEntry('hold-1', -5000),
      makeHoldEntry('hold-2', -3000),
    ];
    const releases = [{ reversalOfEntryId: 'hold-1' }];

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain(holds))
      .mockReturnValueOnce(makeSelectChain(releases));

    const { holds: result, total } = await getHoldList({ status: 'active', page: 1, pageSize: 50 });

    expect(total).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('hold-2');
  });

  it('excludes released holds from active list', async () => {
    const holds = [makeHoldEntry('hold-1', -5000)];
    const releases = [{ reversalOfEntryId: 'hold-1' }];

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain(holds))
      .mockReturnValueOnce(makeSelectChain(releases));

    const { holds: result } = await getHoldList({ status: 'active', page: 1, pageSize: 50 });

    expect(result).toHaveLength(0);
  });

  it('returns empty arrays when no holds exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { holds: result, total } = await getHoldList({ status: 'active', page: 1, pageSize: 50 });

    expect(result).toHaveLength(0);
    expect(total).toBe(0);
  });
});

// ─── getHoldList (released) ───────────────────────────────────────────────────

describe('getHoldList - released', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns released holds in last 30 days', async () => {
    const releases = [makeReleaseEntry('rel-1', 'hold-1')];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ total: 1 }]))
      .mockReturnValueOnce(makeSelectChain(releases));

    const { holds: result, total } = await getHoldList({ status: 'released', page: 1, pageSize: 50 });

    expect(total).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('RESERVE_RELEASE');
  });

  it('returns empty arrays when no releases in last 30 days', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { holds: result, total } = await getHoldList({ status: 'released', page: 1, pageSize: 50 });

    expect(result).toHaveLength(0);
    expect(total).toBe(0);
  });
});
