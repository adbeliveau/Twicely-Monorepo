import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(() => ({ type: 'count' })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  gte: vi.fn((col, val) => ({ type: 'gte', col, val })),
  lt: vi.fn((col, val) => ({ type: 'lt', col, val })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    id: 'id',
    status: 'status',
    scheduledAt: 'scheduled_at',
    confirmedAt: 'confirmed_at',
    noShowFeeChargedAt: 'no_show_fee_charged_at',
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chainable: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where'].forEach((key) => {
    chainable[key] = vi.fn().mockReturnValue(chainable);
  });
  return chainable;
}

// ─── getLocalDashboardStats ───────────────────────────────────────────────────

describe('getLocalDashboardStats', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns correct stats structure with all three fields', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 8 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 5 }]))
      .mockReturnValueOnce(makeSelectChain([{ count: 2 }]));

    const { getLocalDashboardStats } = await import('../local-dashboard-stats');
    const result = await getLocalDashboardStats();

    expect(result).toEqual({
      scheduledToday: 8,
      completedToday: 5,
      noShowsToday: 2,
    });
  });

  it('returns zeros when no local transactions exist today', async () => {
    for (let i = 0; i < 3; i++) {
      mockDbSelect.mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    }

    const { getLocalDashboardStats } = await import('../local-dashboard-stats');
    const result = await getLocalDashboardStats();

    expect(result.scheduledToday).toBe(0);
    expect(result.completedToday).toBe(0);
    expect(result.noShowsToday).toBe(0);
  });

  it('returns zeros when DB returns empty rows', async () => {
    for (let i = 0; i < 3; i++) {
      mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    }

    const { getLocalDashboardStats } = await import('../local-dashboard-stats');
    const result = await getLocalDashboardStats();

    expect(result.scheduledToday).toBe(0);
    expect(result.completedToday).toBe(0);
    expect(result.noShowsToday).toBe(0);
  });

  it('executes exactly 3 db.select() calls', async () => {
    for (let i = 0; i < 3; i++) {
      mockDbSelect.mockReturnValueOnce(makeSelectChain([{ count: 0 }]));
    }

    const { getLocalDashboardStats } = await import('../local-dashboard-stats');
    await getLocalDashboardStats();

    expect(mockDbSelect).toHaveBeenCalledTimes(3);
  });
});
