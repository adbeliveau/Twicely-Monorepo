import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  helpdeskCase: {
    id: 'id',
    status: 'status',
    channel: 'channel',
    priority: 'priority',
    resolvedAt: 'resolved_at',
    closedAt: 'closed_at',
    createdAt: 'created_at',
    lastActivityAt: 'last_activity_at',
    firstResponseAt: 'first_response_at',
    assignedAgentId: 'assigned_agent_id',
    slaFirstResponseBreached: 'sla_first_response_breached',
    slaResolutionBreached: 'sla_resolution_breached',
    slaFirstResponseDueAt: 'sla_first_response_due_at',
  },
  caseCsat: {
    rating: 'rating',
    respondedAt: 'responded_at',
  },
  staffUser: {
    id: 'id',
    displayName: 'display_name',
    isActive: 'is_active',
  },
}));

// sql tagged template must return an object with .as() method for column aliases
function makeSqlExpr(raw: string) {
  const expr = { sql: raw, as: (alias: string) => ({ sql: raw, alias }) };
  return expr;
}

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  not: vi.fn((a: unknown) => ({ not: a })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  gte: vi.fn((a: unknown, b: unknown) => ({ gte: [a, b] })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ inArray: [col, vals] })),
  isNotNull: vi.fn((col: unknown) => ({ isNotNull: col })),
  count: vi.fn(() => ({ count: true })),
  sql: Object.assign(
    (tpl: TemplateStringsArray, ...vals: unknown[]) => {
      const raw = tpl.join(String(vals[0] ?? ''));
      return makeSqlExpr(raw);
    },
    { as: vi.fn(), join: vi.fn((items: unknown[]) => ({ join: items })) }
  ),
  asc: vi.fn((col: unknown) => ({ asc: col })),
  desc: vi.fn((col: unknown) => ({ desc: col })),
  groupBy: vi.fn((...args: unknown[]) => ({ groupBy: args })),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'innerJoin', 'groupBy', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

// =============================================================================
// getHelpdeskDashboardStats
// =============================================================================

describe('getHelpdeskDashboardStats', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all 9 stat fields with numeric/null values', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      // 9 parallel queries — return different rows for each
      if (call === 1) return makeSelectChain([{ count: 42 }]);                    // openCases
      if (call === 2) return makeSelectChain([{ count: 7 }]);                     // resolvedToday
      if (call === 3) return makeSelectChain([{ count: 3 }]);                     // slaBreached
      if (call === 4) return makeSelectChain([{ avgMinutes: 15 }]);               // avgResponse
      if (call === 5) return makeSelectChain([{ avgRating: 4.5, responseCount: 20 }]); // csat
      if (call === 6) return makeSelectChain([{ avgMinutes: 120 }]);              // avgResolution
      if (call === 7) return makeSelectChain([{ compliant: 90, total: 100 }]);    // slaCompliance
      if (call === 8) return makeSelectChain([{ compliant: 85, total: 100 }]);    // slaFirstResponse
      return makeSelectChain([{ compliant: 88, total: 100 }]);                    // slaResolution
    });

    const { getHelpdeskDashboardStats } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskDashboardStats();
    expect(result.openCases).toBe(42);
    expect(result.resolvedToday).toBe(7);
    expect(result.slaBreached).toBe(3);
    expect(result.avgResponseMinutes).toBe(15);
    expect(result.csatScore).toBe(4.5);
    expect(result.csatCount).toBe(20);
    expect(result.avgResolutionMinutes).toBe(120);
    expect(result.slaCompliancePct).toBe(90);
    expect(result.slaFirstResponsePct).toBe(85);
    expect(result.slaResolutionPct).toBe(88);
  });

  it('returns csatScore as null when no CSAT responses', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeSelectChain([{ avgRating: null, responseCount: 0 }]); // no responses
      return makeSelectChain([{ count: 0, avgMinutes: 0, compliant: 0, total: 0 }]);
    });

    const { getHelpdeskDashboardStats } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskDashboardStats();
    expect(result.csatScore).toBeNull();
    expect(result.csatCount).toBe(0);
  });

  it('returns 100 slaCompliancePct when no cases with SLA have been tracked', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([{ count: 0, compliant: 0, total: 0, avgMinutes: 0, avgRating: null, responseCount: 0 }]));
    const { getHelpdeskDashboardStats } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskDashboardStats();
    // When total = 0, slaCompliancePct defaults to 100
    expect(result.slaCompliancePct).toBe(100);
    expect(result.slaFirstResponsePct).toBe(100);
    expect(result.slaResolutionPct).toBe(100);
  });

  it('returns 0 for all counts when data is empty', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([{}]));
    const { getHelpdeskDashboardStats } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskDashboardStats();
    expect(result.openCases).toBe(0);
    expect(result.resolvedToday).toBe(0);
    expect(result.slaBreached).toBe(0);
    expect(result.avgResponseMinutes).toBe(0);
    expect(result.avgResolutionMinutes).toBe(0);
  });
});

// =============================================================================
// getHelpdeskCaseVolume
// =============================================================================

describe('getHelpdeskCaseVolume', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns 7-day array with Mon–Sun entries', async () => {
    // Single query with groupBy
    mockDbSelect.mockReturnValue(makeSelectChain([
      { day: 'Mon', channel: 'EMAIL', count: 5 },
      { day: 'Mon', channel: 'WEB',   count: 3 },
      { day: 'Tue', channel: 'EMAIL', count: 2 },
    ]));

    const { getHelpdeskCaseVolume } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskCaseVolume();
    expect(result).toHaveLength(7);
    // Order is Mon-Sun
    const dayNames = result.map((r) => r.date);
    expect(dayNames).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('aggregates EMAIL, WEB, and SYSTEM channels', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { day: 'Wed', channel: 'EMAIL',    count: 10 },
      { day: 'Wed', channel: 'WEB',      count: 4  },
      { day: 'Wed', channel: 'INTERNAL', count: 1  }, // maps to system
    ]));

    const { getHelpdeskCaseVolume } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskCaseVolume();
    const wed = result.find((r) => r.date === 'Wed');
    expect(wed?.email).toBe(10);
    expect(wed?.web).toBe(4);
    expect(wed?.system).toBe(1); // INTERNAL → system bucket
  });

  it('returns zeros for days with no activity', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getHelpdeskCaseVolume } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskCaseVolume();
    for (const day of result) {
      expect(day.email).toBe(0);
      expect(day.web).toBe(0);
      expect(day.system).toBe(0);
    }
  });

  it('accumulates multiple non-EMAIL/WEB channels into system bucket', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { day: 'Fri', channel: 'SYSTEM',   count: 3 },
      { day: 'Fri', channel: 'INTERNAL', count: 2 },
    ]));

    const { getHelpdeskCaseVolume } = await import('../helpdesk-dashboard');
    const result = await getHelpdeskCaseVolume();
    const fri = result.find((r) => r.date === 'Fri');
    expect(fri?.system).toBe(5); // 3 + 2 accumulated
  });
});

// =============================================================================
// getTeamWorkload
// =============================================================================

describe('getTeamWorkload', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns workload items for each assigned agent', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { agentId: 'staff-1', displayName: 'Alice Smith', caseCount: 8 },
      { agentId: 'staff-2', displayName: 'Bob Jones',  caseCount: 12 },
    ]));

    const { getTeamWorkload } = await import('../helpdesk-dashboard');
    const result = await getTeamWorkload();
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Alice Smith');
    expect(result[0]?.current).toBe(8);
    expect(result[0]?.max).toBe(25); // hardcoded max
    expect(result[1]?.name).toBe('Bob Jones');
  });

  it('computes initials from display name', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { agentId: 'staff-1', displayName: 'Charlie Davis', caseCount: 5 },
    ]));

    const { getTeamWorkload } = await import('../helpdesk-dashboard');
    const result = await getTeamWorkload();
    expect(result[0]?.initials).toBe('CD'); // first letter of each word
  });

  it('handles single-word display names', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { agentId: 'staff-2', displayName: 'Admin', caseCount: 2 },
    ]));

    const { getTeamWorkload } = await import('../helpdesk-dashboard');
    const result = await getTeamWorkload();
    expect(result[0]?.initials).toBe('A'); // single word = single initial
  });

  it('returns empty array when no agents have open cases', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getTeamWorkload } = await import('../helpdesk-dashboard');
    const result = await getTeamWorkload();
    expect(result).toHaveLength(0);
  });

  it('all items have max = 25', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { agentId: 's1', displayName: 'Ev Ry', caseCount: 20 },
      { agentId: 's2', displayName: 'Mu Tho', caseCount: 1 },
    ]));

    const { getTeamWorkload } = await import('../helpdesk-dashboard');
    const result = await getTeamWorkload();
    for (const item of result) {
      expect(item.max).toBe(25);
    }
  });
});
