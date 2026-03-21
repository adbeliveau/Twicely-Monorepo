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

// ─── getDashboardKPIs ─────────────────────────────────────────────────────────

describe('getDashboardKPIs', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all six KPI fields with correct structure', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 42 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 125000 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 7 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 3210 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 88 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 15 }]));

    const { getDashboardKPIs } = await import('../admin-dashboard');
    const result = await getDashboardKPIs();

    expect(result).toEqual({
      ordersToday: 42,
      revenueToday: 125000,
      openCases: 7,
      activeListings: 3210,
      activeUsers: 88,
      signupsToday: 15,
    });
  });

  it('returns zeros for all KPIs when DB returns empty rows', async () => {
    for (let i = 0; i < 6; i++) {
      mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    }

    const { getDashboardKPIs } = await import('../admin-dashboard');
    const result = await getDashboardKPIs();

    expect(result.ordersToday).toBe(0);
    expect(result.revenueToday).toBe(0);
    expect(result.openCases).toBe(0);
    expect(result.activeListings).toBe(0);
    expect(result.activeUsers).toBe(0);
    expect(result.signupsToday).toBe(0);
  });

  it('coerces revenueToday to number (from SQL aggregate string)', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 5 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: '98765' }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 100 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: '50' }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 3 }]));

    const { getDashboardKPIs } = await import('../admin-dashboard');
    const result = await getDashboardKPIs();

    expect(typeof result.revenueToday).toBe('number');
    expect(result.revenueToday).toBe(98765);
  });

  it('executes exactly 6 db.select() calls', async () => {
    const chain = makeSelectChain([{ count: 0 }]);
    mockDbSelect.mockReturnValue(chain);

    const { getDashboardKPIs } = await import('../admin-dashboard');
    await getDashboardKPIs();

    expect(mockDbSelect).toHaveBeenCalledTimes(6);
  });

  it('returns numeric activeUsers (from COUNT DISTINCT sql)', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: '77' }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]));

    const { getDashboardKPIs } = await import('../admin-dashboard');
    const result = await getDashboardKPIs();

    expect(typeof result.activeUsers).toBe('number');
    expect(result.activeUsers).toBe(77);
  });
});
