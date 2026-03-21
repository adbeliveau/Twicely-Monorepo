import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// MOCKS
// =============================================================================

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  helpdeskCase: {
    id: 'id',
    caseNumber: 'case_number',
    subject: 'subject',
    status: {
      enumValues: ['NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED'],
    },
    priority: {
      enumValues: ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'],
    },
    type: 'type',
    channel: {
      enumValues: ['WEB', 'EMAIL', 'SYSTEM', 'INTERNAL'],
    },
    requesterId: 'requester_id',
    requesterEmail: 'requester_email',
    assignedAgentId: 'assigned_agent_id',
    assignedTeamId: 'assigned_team_id',
    slaFirstResponseDueAt: 'sla_first_response_due_at',
    firstResponseAt: 'first_response_at',
    createdAt: 'created_at',
    lastActivityAt: 'last_activity_at',
  },
  helpdeskTeam: { id: 'id', name: 'name' },
  caseMessage: { caseId: 'case_id', direction: 'direction', createdAt: 'created_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((col: unknown) => ({ desc: col })),
  ilike: vi.fn((col: unknown, val: unknown) => ({ ilike: [col, val] })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ inArray: [col, vals] })),
  isNull: vi.fn((col: unknown) => ({ isNull: col })),
  sql: Object.assign(
    vi.fn((tpl: TemplateStringsArray, ...vals: unknown[]) => ({ sql: tpl.join('?'), vals })),
    { join: vi.fn((items: unknown[], _sep: unknown) => ({ join: items })) }
  ),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeAllowed(staffUserId = 'staff-001') {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId,
    email: 'agent@hub.twicely.co',
    displayName: 'Agent',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function makeForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-002',
    email: 'limited@hub.twicely.co',
    displayName: 'Limited',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function makeUnauthorized() {
  mockStaffAuthorize.mockRejectedValue(new Error('Not authenticated'));
}

const NOW = new Date('2026-01-15T12:00:00Z');

function makeCaseRow(overrides: Partial<{
  id: string; status: string; assignedTeamId: string | null; assignedAgentId: string | null;
}> = {}) {
  return {
    id: 'case-001',
    caseNumber: 'HD-000101',
    subject: 'Test case',
    status: 'OPEN',
    priority: 'NORMAL',
    type: 'SUPPORT',
    channel: 'WEB',
    requesterId: 'user-001',
    requesterEmail: 'buyer@test.com',
    assignedAgentId: null,
    assignedTeamId: null,
    slaFirstResponseDue: null,
    firstResponseAt: null,
    createdAt: NOW,
    lastActivityAt: NOW,
    ...overrides,
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeRequest(params = '') {
  return new NextRequest(`http://localhost/api/hub/helpdesk/cases${params ? `?${params}` : ''}`);
}

// =============================================================================
// Auth tests
// =============================================================================

describe('GET /api/hub/helpdesk/cases — auth', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns 401 for unauthenticated requests', async () => {
    makeUnauthorized();
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when CASL denies read on HelpdeskCase', async () => {
    makeForbidden();
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 with cases array for authenticated staff', async () => {
    makeAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([makeCaseRow()]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.cases)).toBe(true);
  });
});

// =============================================================================
// Filter params
// =============================================================================

describe('GET /api/hub/helpdesk/cases — filter params', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns only matching cases for valid status filter', async () => {
    makeAllowed();
    const openCase = makeCaseRow({ id: 'case-open', status: 'OPEN' });
    mockDbSelect.mockImplementation(() => makeSelectChain([openCase]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest('status=OPEN'));
    const body = await res.json() as { cases: Array<{ status: string }> };
    expect(res.status).toBe(200);
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0]?.status).toBe('OPEN');
  });

  it('ignores invalid status values (not in VALID_STATUSES)', async () => {
    makeAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([makeCaseRow()]));
    const { GET } = await import('../route');
    // INVALID_STATUS is not in the valid set — should be ignored, not crash
    const res = await GET(makeRequest('status=INVALID_STATUS'));
    expect(res.status).toBe(200);
  });

  it('ignores invalid priority values', async () => {
    makeAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([makeCaseRow()]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest('priority=BANANA'));
    expect(res.status).toBe(200);
  });

  it('ignores invalid channel values', async () => {
    makeAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([makeCaseRow()]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest('channel=FAX'));
    expect(res.status).toBe(200);
  });

  it('returns empty array when no cases exist', async () => {
    makeAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: unknown[]; total: number };
    expect(body.cases).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('includes total count in response', async () => {
    makeAllowed();
    mockDbSelect.mockImplementation(() => makeSelectChain([makeCaseRow(), makeCaseRow({ id: 'case-002' })]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { total: number };
    expect(body.total).toBe(2);
  });
});

// =============================================================================
// Assignee filter (me / unassigned)
// =============================================================================

describe('GET /api/hub/helpdesk/cases — assignee filter', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('assignee=me filters to current agent cases', async () => {
    makeAllowed('agent-xyz');
    const myCase = makeCaseRow({ id: 'my-case', assignedAgentId: 'agent-xyz' });
    mockDbSelect.mockImplementation(() => makeSelectChain([myCase]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest('assignee=me'));
    expect(res.status).toBe(200);
    const body = await res.json() as { cases: Array<{ assignedAgentId: string }> };
    expect(body.cases[0]?.assignedAgentId).toBe('agent-xyz');
  });

  it('assignee=unassigned filters to cases with null assignedAgentId', async () => {
    makeAllowed();
    const unassignedCase = makeCaseRow({ id: 'unassigned', assignedAgentId: null });
    mockDbSelect.mockImplementation(() => makeSelectChain([unassignedCase]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest('assignee=unassigned'));
    expect(res.status).toBe(200);
    const body = await res.json() as { cases: Array<{ assignedAgentId: unknown }> };
    expect(body.cases[0]?.assignedAgentId).toBeNull();
  });
});

// =============================================================================
// Team name enrichment
// =============================================================================

describe('GET /api/hub/helpdesk/cases — team enrichment', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('enriches assignedTeam with display name when assignedTeamId is set', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        // main cases query — case with a team assigned
        return makeSelectChain([makeCaseRow({ id: 'case-with-team', assignedTeamId: 'team-001' })]);
      }
      if (selectCall === 2) {
        // teams query
        return makeSelectChain([{ id: 'team-001', name: 'Customer Support' }]);
      }
      // messages query — no messages
      return makeSelectChain([]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ assignedTeam: { id: string; displayName: string } | null }> };
    expect(body.cases[0]?.assignedTeam).not.toBeNull();
    expect(body.cases[0]?.assignedTeam?.displayName).toBe('Customer Support');
  });

  it('falls back to "Unknown" when team not found in teams query', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return makeSelectChain([makeCaseRow({ id: 'case-missing-team', assignedTeamId: 'team-ghost' })]);
      }
      if (selectCall === 2) {
        // teams query returns empty (team was deleted)
        return makeSelectChain([]);
      }
      return makeSelectChain([]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ assignedTeam: { displayName: string } | null }> };
    expect(body.cases[0]?.assignedTeam?.displayName).toBe('Unknown');
  });

  it('sets assignedTeam to null when assignedTeamId is null', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([makeCaseRow({ assignedTeamId: null })]);
      // No teams query fired (no team ids)
      return makeSelectChain([]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ assignedTeam: unknown }> };
    expect(body.cases[0]?.assignedTeam).toBeNull();
  });
});
