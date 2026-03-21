/**
 * Tests for dashboard users chart data (I16)
 * getDashboardCharts returns users array for both 7d and 30d periods.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings.join('?'), vals })),
  gte: vi.fn((col, val) => ({ type: 'gte', col, val })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  count: vi.fn(() => ({ type: 'count' })),
}));

vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', createdAt: 'created_at', totalCents: 'total_cents', buyerId: 'buyer_id', status: 'status' },
  user: { id: 'id', createdAt: 'created_at' },
  listing: { id: 'id', status: 'status' },
  auditEvent: { id: 'id', action: 'action', subject: 'subject', severity: 'severity', createdAt: 'created_at' },
  helpdeskCase: { id: 'id', status: 'status' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chainable: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'innerJoin', 'leftJoin', 'where', 'groupBy', 'orderBy', 'limit', 'offset'].forEach((key) => {
    chainable[key] = vi.fn().mockReturnValue(chainable);
  });
  return chainable;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDashboardCharts — users data', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('getDashboardCharts returns users data for 7d period', async () => {
    const userRows = [
      { date: '2026-03-14', value: 3 },
      { date: '2026-03-15', value: 7 },
    ];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain(userRows));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('7d');

    expect(result.users).toHaveLength(2);
    expect(result.users[0]).toEqual({ date: '2026-03-14', value: 3 });
    expect(result.users[1]).toEqual({ date: '2026-03-15', value: 7 });
  });

  it('getDashboardCharts returns users data for 30d period', async () => {
    const userRows = [{ date: '2026-02-20', value: 12 }];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain(userRows));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('30d');

    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.value).toBe(12);
  });

  it('users chart returns empty array when no signups', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('7d');

    expect(result.users).toEqual([]);
  });

  it('users data grouped by date correctly', async () => {
    const userRows = [
      { date: '2026-03-01', value: 5 },
      { date: '2026-03-02', value: 8 },
      { date: '2026-03-03', value: 2 },
    ];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain(userRows));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('7d');

    expect(result.users).toHaveLength(3);
    result.users.forEach((point) => {
      expect(typeof point.date).toBe('string');
      expect(typeof point.value).toBe('number');
    });
  });
});
