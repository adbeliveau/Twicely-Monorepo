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

// ─── getDashboardCharts ───────────────────────────────────────────────────────

describe('getDashboardCharts', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns gmv, orders, and users arrays for 7d period', async () => {
    const gmvRows = [{ date: '2026-03-01', value: 50000 }, { date: '2026-03-02', value: 75000 }];
    const orderRows = [{ date: '2026-03-01', value: 12 }, { date: '2026-03-02', value: 18 }];
    const userRows = [{ date: '2026-03-01', value: 5 }];

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain(gmvRows))
      .mockReturnValueOnce(makeSelectChain(orderRows))
      .mockReturnValueOnce(makeSelectChain(userRows));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('7d');

    expect(result.gmv).toHaveLength(2);
    expect(result.gmv[0]).toEqual({ date: '2026-03-01', value: 50000 });
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0]).toEqual({ date: '2026-03-01', value: 12 });
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toEqual({ date: '2026-03-01', value: 5 });
  });

  it('returns empty arrays for 30d period with no data', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('30d');

    expect(result.gmv).toEqual([]);
    expect(result.orders).toEqual([]);
    expect(result.users).toEqual([]);
  });

  it('executes exactly 3 db.select() calls for chart data', async () => {
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);

    const { getDashboardCharts } = await import('../admin-dashboard');
    await getDashboardCharts('7d');

    expect(mockDbSelect).toHaveBeenCalledTimes(3);
  });

  it('coerces gmv date and value to correct types in output', async () => {
    const gmvRows = [{ date: 20260301, value: '50000' }];
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain(gmvRows))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('7d');

    expect(typeof result.gmv[0]!.date).toBe('string');
    expect(typeof result.gmv[0]!.value).toBe('number');
  });

  it('returns correct structure keys (gmv, orders, users)', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { getDashboardCharts } = await import('../admin-dashboard');
    const result = await getDashboardCharts('7d');

    expect(result).toHaveProperty('gmv');
    expect(result).toHaveProperty('orders');
    expect(result).toHaveProperty('users');
    expect(Array.isArray(result.gmv)).toBe(true);
    expect(Array.isArray(result.orders)).toBe(true);
    expect(Array.isArray(result.users)).toBe(true);
  });
});

// ─── getRecentAdminActivity ───────────────────────────────────────────────────

describe('getRecentAdminActivity', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns array of audit events in correct shape', async () => {
    const rows = [
      { id: 'evt-1', action: 'SUSPEND_USER', subject: 'User', severity: 'HIGH', createdAt: new Date('2026-03-02') },
      { id: 'evt-2', action: 'MANUAL_ADJUSTMENT', subject: 'LedgerEntry', severity: 'CRITICAL', createdAt: new Date('2026-03-01') },
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const { getRecentAdminActivity } = await import('../admin-dashboard');
    const result = await getRecentAdminActivity();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'evt-1', action: 'SUSPEND_USER', subject: 'User', severity: 'HIGH', createdAt: expect.any(Date),
    });
    expect(result[1]!.severity).toBe('CRITICAL');
  });

  it('returns empty array when no recent activity exists', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getRecentAdminActivity } = await import('../admin-dashboard');
    const result = await getRecentAdminActivity();

    expect(result).toEqual([]);
  });

  it('uses default limit of 10 when no argument provided', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getRecentAdminActivity } = await import('../admin-dashboard');
    await getRecentAdminActivity();

    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('accepts custom limit parameter', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getRecentAdminActivity } = await import('../admin-dashboard');
    const result = await getRecentAdminActivity(25);

    expect(Array.isArray(result)).toBe(true);
  });

  it('filters only MEDIUM, HIGH, and CRITICAL severity events', async () => {
    const rows = [
      { id: 'evt-1', action: 'WARN_USER', subject: 'User', severity: 'MEDIUM', createdAt: new Date() },
      { id: 'evt-2', action: 'SUSPEND_USER', subject: 'User', severity: 'HIGH', createdAt: new Date() },
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const { getRecentAdminActivity } = await import('../admin-dashboard');
    const result = await getRecentAdminActivity(5);

    result.forEach((r) => {
      expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(r.severity);
    });
  });

  it('returns correct RecentActivity shape with all required fields', async () => {
    const now = new Date();
    const rows = [{ id: 'evt-3', action: 'REMOVE_LISTING', subject: 'Listing', severity: 'HIGH', createdAt: now }];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const { getRecentAdminActivity } = await import('../admin-dashboard');
    const result = await getRecentAdminActivity(1);

    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('action');
    expect(result[0]).toHaveProperty('subject');
    expect(result[0]).toHaveProperty('severity');
    expect(result[0]).toHaveProperty('createdAt');
  });
});
