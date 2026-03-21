import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  helpdeskCase: {
    id: 'id', caseNumber: 'case_number', subject: 'subject',
    type: 'type', priority: 'priority', requesterEmail: 'requester_email',
    assignedAgentId: 'assigned_agent_id', resolvedAt: 'resolved_at',
    closedAt: 'closed_at', createdAt: 'created_at', status: 'status',
  },
  helpdeskTeamMember: {
    staffUserId: 'staff_user_id', isAvailable: 'is_available', teamId: 'team_id',
  },
  caseWatcher: { caseId: 'case_id', staffUserId: 'staff_user_id', id: 'id', createdAt: 'created_at' },
  staffUser: { id: 'id', displayName: 'display_name' },
}));

const RESOLVED_CASES = [
  { id: 'case-1', caseNumber: 'HD-001', subject: 'Issue A', type: 'SUPPORT', priority: 'NORMAL', requesterEmail: 'a@test.com', assignedAgentId: null, resolvedAt: new Date('2026-01-10'), closedAt: null, createdAt: new Date('2026-01-01') },
  { id: 'case-2', caseNumber: 'HD-002', subject: 'Issue B', type: 'DISPUTE', priority: 'HIGH', requesterEmail: 'b@test.com', assignedAgentId: 'agent-1', resolvedAt: new Date('2026-01-09'), closedAt: null, createdAt: new Date('2026-01-02') },
];

const CLOSED_CASES = [
  { id: 'case-3', caseNumber: 'HD-003', subject: 'Issue C', type: 'RETURN', priority: 'LOW', requesterEmail: null, assignedAgentId: null, resolvedAt: new Date('2025-12-01'), closedAt: new Date('2025-12-08'), createdAt: new Date('2025-11-30') },
];

function makeSelectChain(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

describe('getResolvedCases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns RESOLVED cases sorted by resolvedAt DESC', async () => {
    mockSelect.mockReturnValue(makeSelectChain(RESOLVED_CASES));
    const { getResolvedCases } = await import('../helpdesk-cases');
    const result = await getResolvedCases('resolved');
    expect(result).toHaveLength(2);
    expect(result[0]?.caseNumber).toBe('HD-001');
  });

  it('returns CLOSED cases sorted by closedAt DESC', async () => {
    mockSelect.mockReturnValue(makeSelectChain(CLOSED_CASES));
    const { getResolvedCases } = await import('../helpdesk-cases');
    const result = await getResolvedCases('closed');
    expect(result).toHaveLength(1);
    expect(result[0]?.closedAt).toBeTruthy();
  });

  it('returns empty array when no matching cases', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getResolvedCases } = await import('../helpdesk-cases');
    const result = await getResolvedCases('resolved');
    expect(result).toHaveLength(0);
  });

  it('respects custom limit parameter', async () => {
    mockSelect.mockReturnValue(makeSelectChain(RESOLVED_CASES.slice(0, 1)));
    const { getResolvedCases } = await import('../helpdesk-cases');
    const result = await getResolvedCases('resolved', 1);
    expect(result).toHaveLength(1);
  });
});

describe('getAgentOnlineStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns true when agent has no team memberships', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getAgentOnlineStatus } = await import('../helpdesk-agents');
    const result = await getAgentOnlineStatus('staff-no-teams');
    expect(result).toBe(true);
  });

  it('returns persisted isAvailable value from team membership', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ isAvailable: false }]));
    const { getAgentOnlineStatus } = await import('../helpdesk-agents');
    const result = await getAgentOnlineStatus('staff-offline');
    expect(result).toBe(false);
  });

  it('returns true when membership isAvailable is true', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ isAvailable: true }]));
    const { getAgentOnlineStatus } = await import('../helpdesk-agents');
    const result = await getAgentOnlineStatus('staff-online');
    expect(result).toBe(true);
  });
});
