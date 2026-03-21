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
    {
      join: vi.fn((items: unknown[], _sep: unknown) => ({ join: items })),
    }
  ),
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeAllowed() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId: 'staff-001',
    email: 'agent@hub.twicely.co',
    displayName: 'Agent',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

const NOW = new Date('2026-01-15T12:00:00Z');

function makeCaseRow(overrides: Partial<{
  id: string; status: string; assignedTeamId: string | null;
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
    assignedTeamId: null, // null means teams query is SKIPPED
    slaFirstResponseDue: null,
    firstResponseAt: null,
    createdAt: NOW,
    lastActivityAt: NOW,
    ...overrides,
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeRequest(params = '') {
  return new NextRequest(`http://localhost/api/hub/helpdesk/cases${params ? `?${params}` : ''}`);
}

// =============================================================================
// hasUnread logic
// NOTE: When assignedTeamId is null (all test cases), the teams query is SKIPPED.
// So the select call sequence is:
//   call 1 = main cases query
//   call 2 = lastMessages query (open cases only)
// For RESOLVED/CLOSED cases: call 1 = main cases query only (no lastMessages)
// =============================================================================

describe('hasUnread logic in cases API route', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('cases with last INBOUND message show hasUnread = true', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        // main cases query — one OPEN case with no team assigned
        return makeSelectChain([makeCaseRow({ id: 'case-101', status: 'OPEN' })]);
      }
      // selectCall === 2: lastMessages query — INBOUND is the last message
      return makeSelectChain([{ caseId: 'case-101', direction: 'INBOUND' }]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ id: string; hasUnread: boolean }> };
    expect(body.cases[0]?.hasUnread).toBe(true);
  });

  it('cases with last OUTBOUND message show hasUnread = false', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([makeCaseRow({ id: 'case-102', status: 'OPEN' })]);
      // last message is OUTBOUND — agent replied
      return makeSelectChain([{ caseId: 'case-102', direction: 'OUTBOUND' }]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ id: string; hasUnread: boolean }> };
    expect(body.cases[0]?.hasUnread).toBe(false);
  });

  it('cases with no messages show hasUnread = false', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) return makeSelectChain([makeCaseRow({ id: 'case-103', status: 'OPEN' })]);
      // no message rows at all for this case
      return makeSelectChain([]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ id: string; hasUnread: boolean }> };
    expect(body.cases[0]?.hasUnread).toBe(false);
  });

  it('RESOLVED and CLOSED cases always show hasUnread = false', async () => {
    makeAllowed();
    let selectCall = 0;
    mockDbSelect.mockImplementation(() => {
      selectCall++;
      // Only call 1 happens — cases query. No lastMessages query for RESOLVED/CLOSED.
      return makeSelectChain([
        makeCaseRow({ id: 'case-resolved', status: 'RESOLVED' }),
        makeCaseRow({ id: 'case-closed', status: 'CLOSED' }),
      ]);
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const body = await res.json() as { cases: Array<{ id: string; hasUnread: boolean }> };
    expect(body.cases[0]?.hasUnread).toBe(false);
    expect(body.cases[1]?.hasUnread).toBe(false);
    // Only 1 select call: cases query only (openCaseIds is empty → lastMessages skipped)
    expect(selectCall).toBe(1);
  });
});
