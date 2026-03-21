import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  helpdeskTeam: { id: 'id', name: 'name' },
  helpdeskTeamMember: { teamId: 'team_id', staffUserId: 'staff_user_id', isAvailable: 'is_available' },
  helpdeskCase: {
    id: 'id', assignedAgentId: 'assigned_agent_id', status: 'status', lastActivityAt: 'last_activity_at',
  },
  staffUser: { id: 'id' },
  caseCsat: { rating: 'rating', respondedAt: 'responded_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  or: vi.fn((...args: unknown[]) => ({ or: args })),
  not: vi.fn((a: unknown) => ({ not: a })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  gte: vi.fn((a: unknown, b: unknown) => ({ gte: [a, b] })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ inArray: [col, vals] })),
  isNotNull: vi.fn((col: unknown) => ({ isNotNull: col })),
  count: vi.fn(() => ({ count: true })),
  sql: Object.assign(vi.fn((tpl: TemplateStringsArray) => ({ sql: tpl.join('') })), {
    as: vi.fn(),
  }),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'innerJoin', 'leftJoin', 'orderBy', 'groupBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

// =============================================================================
// getTeamStatusGrid
// =============================================================================

describe('getTeamStatusGrid', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns teams with online/away/offline counts', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) {
        // teams query
        return makeSelectChain([
          { id: 'team-001', name: 'Support' },
        ]);
      }
      if (call === 2) {
        // members query
        return makeSelectChain([
          { teamId: 'team-001', isAvailable: true,  staffUserId: 'staff-a' },
          { teamId: 'team-001', isAvailable: true,  staffUserId: 'staff-b' },
          { teamId: 'team-001', isAvailable: false, staffUserId: 'staff-c' },
        ]);
      }
      // recent cases query — staff-a is recently active
      return makeSelectChain([{ agentId: 'staff-a' }]);
    });

    const { getTeamStatusGrid } = await import('../helpdesk-dashboard');
    const result = await getTeamStatusGrid();
    expect(result).toHaveLength(1);
    const team = result[0]!;
    expect(team.teamName).toBe('Support');
    expect(team.online).toBe(1);  // staff-a: available + recently active
    expect(team.away).toBe(1);    // staff-b: available + not recently active
    expect(team.offline).toBe(1); // staff-c: not available
    expect(team.total).toBe(3);
  });

  it('returns empty array when there are no teams', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([]));

    const { getTeamStatusGrid } = await import('../helpdesk-dashboard');
    const result = await getTeamStatusGrid();
    expect(result).toHaveLength(0);
  });

  it('returns zero counts for teams with no members', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ id: 'team-empty', name: 'Empty Team' }]);
      if (call === 2) return makeSelectChain([]); // no members
      return makeSelectChain([]);
    });

    const { getTeamStatusGrid } = await import('../helpdesk-dashboard');
    const result = await getTeamStatusGrid();
    expect(result).toHaveLength(1);
    expect(result[0]!.online).toBe(0);
    expect(result[0]!.away).toBe(0);
    expect(result[0]!.offline).toBe(0);
    expect(result[0]!.total).toBe(0);
  });

  it('all available members are away when no recent activity', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ id: 'team-a', name: 'Team A' }]);
      if (call === 2) {
        return makeSelectChain([
          { teamId: 'team-a', isAvailable: true, staffUserId: 'staff-x' },
          { teamId: 'team-a', isAvailable: true, staffUserId: 'staff-y' },
        ]);
      }
      return makeSelectChain([]); // no recent cases
    });

    const { getTeamStatusGrid } = await import('../helpdesk-dashboard');
    const result = await getTeamStatusGrid();
    expect(result[0]!.online).toBe(0);
    expect(result[0]!.away).toBe(2);
    expect(result[0]!.offline).toBe(0);
  });

  it('returns teamId and teamName on each item', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([{ id: 'team-xyz', name: 'Technical Support' }]);
      if (call === 2) return makeSelectChain([]);
      return makeSelectChain([]);
    });

    const { getTeamStatusGrid } = await import('../helpdesk-dashboard');
    const result = await getTeamStatusGrid();
    expect(result[0]!.teamId).toBe('team-xyz');
    expect(result[0]!.teamName).toBe('Technical Support');
  });
});

// =============================================================================
// getStatTrends
// =============================================================================

describe('getStatTrends', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns 7-day arrays for all 5 metrics', async () => {
    // getStatTrends runs 7 days × 5 queries = 35 parallel select calls
    mockDbSelect.mockImplementation(() => makeSelectChain([{ count: 5, avg: 10 }]));

    const { getStatTrends } = await import('../helpdesk-dashboard');
    const result = await getStatTrends();
    expect(result.openCasesTrend).toHaveLength(7);
    expect(result.resolvedTrend).toHaveLength(7);
    expect(result.avgResponseTrend).toHaveLength(7);
    expect(result.slaBreachedTrend).toHaveLength(7);
    expect(result.csatTrend).toHaveLength(7);
  });

  it('returns all-zero trends when no data exists', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([{ count: 0, avg: null }]));

    const { getStatTrends } = await import('../helpdesk-dashboard');
    const result = await getStatTrends();
    for (const arr of Object.values(result)) {
      for (const val of arr) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('returns numeric values in each trend array', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([{ count: 3, avg: 15 }]));

    const { getStatTrends } = await import('../helpdesk-dashboard');
    const result = await getStatTrends();
    for (const val of result.openCasesTrend) {
      expect(typeof val).toBe('number');
    }
  });
});
