import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  helpdeskCase: {
    id: 'id',
    caseNumber: 'case_number',
    subject: 'subject',
    description: 'description',
    status: 'status',
    priority: 'priority',
    type: 'type',
    channel: 'channel',
    requesterId: 'requester_id',
    requesterEmail: 'requester_email',
    assignedAgentId: 'assigned_agent_id',
    assignedTeamId: 'assigned_team_id',
    orderId: 'order_id',
    listingId: 'listing_id',
    sellerId: 'seller_id',
    payoutId: 'payout_id',
    disputeCaseId: 'dispute_case_id',
    returnRequestId: 'return_request_id',
    conversationId: 'conversation_id',
    tags: 'tags',
    slaFirstResponseDueAt: 'sla_first_response_due_at',
    slaResolutionDueAt: 'sla_resolution_due_at',
    slaFirstResponseBreached: 'sla_first_response_breached',
    slaResolutionBreached: 'sla_resolution_breached',
    firstResponseAt: 'first_response_at',
    resolvedAt: 'resolved_at',
    closedAt: 'closed_at',
    lastActivityAt: 'last_activity_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  caseMessage: {
    id: 'id',
    caseId: 'case_id',
    senderType: 'sender_type',
    senderId: 'sender_id',
    senderName: 'sender_name',
    direction: 'direction',
    body: 'body',
    bodyHtml: 'body_html',
    attachments: 'attachments',
    deliveryStatus: 'delivery_status',
    createdAt: 'created_at',
  },
  caseEvent: {
    id: 'id',
    caseId: 'case_id',
    eventType: 'event_type',
    actorType: 'actor_type',
    actorId: 'actor_id',
    dataJson: 'data_json',
    createdAt: 'created_at',
  },
  caseWatcher: {
    id: 'id',
    caseId: 'case_id',
    staffUserId: 'staff_user_id',
    createdAt: 'created_at',
  },
  staffUser: { id: 'id', displayName: 'display_name', isActive: 'is_active' },
  helpdeskTeam: { id: 'id', name: 'name' },
  helpdeskTeamMember: { staffUserId: 'staff_user_id', isAvailable: 'is_available' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((col: unknown) => ({ desc: col })),
  asc: vi.fn((col: unknown) => ({ asc: col })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ inArray: [col, vals] })),
}));

// =============================================================================
// HELPERS
// =============================================================================

const NOW = new Date('2026-01-20T10:00:00Z');

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit', 'innerJoin'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeCaseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'case-001',
    caseNumber: 'HD-000101',
    subject: 'Item not received',
    description: null,
    status: 'OPEN',
    priority: 'NORMAL',
    type: 'SUPPORT',
    channel: 'WEB',
    requesterId: 'user-001',
    requesterEmail: 'buyer@test.com',
    assignedAgentId: null,
    assignedTeamId: null,
    tags: [],
    orderId: null,
    listingId: null,
    sellerId: null,
    payoutId: null,
    disputeCaseId: null,
    returnRequestId: null,
    conversationId: null,
    slaFirstResponseDueAt: null,
    slaResolutionDueAt: null,
    slaFirstResponseBreached: false,
    slaResolutionBreached: false,
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    lastActivityAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// =============================================================================
// getCasesByRequester
// =============================================================================

describe('getCasesByRequester', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns cases for a given userId', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeCaseRow()]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-001');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('case-001');
  });

  it('returns empty array when user has no cases', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-no-cases');
    expect(result).toHaveLength(0);
  });

  it('applies status filter when provided', async () => {
    const openCase = makeCaseRow({ status: 'OPEN' });
    mockDbSelect.mockReturnValue(makeSelectChain([openCase]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-001', { status: ['OPEN'] });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('OPEN');
  });

  it('returns all cases when no status filter provided', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeCaseRow({ id: 'c1', status: 'OPEN' }),
      makeCaseRow({ id: 'c2', status: 'RESOLVED' }),
    ]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-001');
    expect(result).toHaveLength(2);
  });

  it('returns multiple status filter when status array has multiple values', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeCaseRow({ id: 'c1', status: 'OPEN' }),
      makeCaseRow({ id: 'c2', status: 'NEW' }),
    ]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-001', { status: ['OPEN', 'NEW'] });
    expect(result).toHaveLength(2);
  });
});

// =============================================================================
// getCaseDetail (user-facing — hides INTERNAL messages)
// =============================================================================

describe('getCaseDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null when case does not exist for user', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getCaseDetail } = await import('../helpdesk-cases');
    const result = await getCaseDetail('nonexistent', 'user-001');
    expect(result).toBeNull();
  });

  it('returns null when caseId belongs to different user', async () => {
    // Query with requesterId check returns empty (case owned by different user)
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getCaseDetail } = await import('../helpdesk-cases');
    const result = await getCaseDetail('case-001', 'user-wrong');
    expect(result).toBeNull();
  });

  it('returns case with messages and events on success', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([makeCaseRow()]);   // case lookup
      if (call === 2) return makeSelectChain([                    // messages (INBOUND/OUTBOUND/SYSTEM)
        { id: 'msg-1', direction: 'INBOUND', body: 'Hello' },
      ]);
      return makeSelectChain([                                     // events
        { id: 'evt-1', eventType: 'created' },
      ]);
    });

    const { getCaseDetail } = await import('../helpdesk-cases');
    const result = await getCaseDetail('case-001', 'user-001');
    expect(result).not.toBeNull();
    expect(result?.messages).toHaveLength(1);
    expect(result?.events).toHaveLength(1);
  });
});

// =============================================================================
// getAgentCaseDetail — includes internal notes
// =============================================================================

describe('getAgentCaseDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null when case does not exist', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getAgentCaseDetail } = await import('../helpdesk-cases');
    const result = await getAgentCaseDetail('nonexistent');
    expect(result).toBeNull();
  });

  it('returns case with all messages including INTERNAL notes', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeSelectChain([makeCaseRow()]);
      if (call === 2) return makeSelectChain([
        { id: 'msg-1', direction: 'INBOUND', body: 'Customer message' },
        { id: 'msg-2', direction: 'INTERNAL', body: 'Agent note' }, // internal included
      ]);
      return makeSelectChain([{ id: 'evt-1', eventType: 'status_changed' }]);
    });

    const { getAgentCaseDetail } = await import('../helpdesk-cases');
    const result = await getAgentCaseDetail('case-001');
    expect(result).not.toBeNull();
    expect(result?.messages).toHaveLength(2); // includes INTERNAL
    expect(result?.messages.find((m) => (m as { direction: string }).direction === 'INTERNAL')).toBeDefined();
  });
});

// =============================================================================
// getAgentCaseQueue
// =============================================================================

describe('getAgentCaseQueue', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all cases when no filters provided', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      makeCaseRow({ id: 'c1' }),
      makeCaseRow({ id: 'c2' }),
    ]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue();
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no cases in queue', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue();
    expect(result).toHaveLength(0);
  });

  it('accepts status and priority filters', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeCaseRow({ status: 'NEW', priority: 'URGENT' })]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue({ status: ['NEW'], priority: ['URGENT'] });
    expect(result).toHaveLength(1);
  });

  it('filters by assignedAgentId when provided', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeCaseRow({ assignedAgentId: 'agent-abc' })]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue({ assignedAgentId: 'agent-abc' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBeDefined();
  });

  it('filters by assignedTeamId when provided', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([makeCaseRow({ assignedTeamId: 'team-x' })]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue({ assignedTeamId: 'team-x' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBeDefined();
  });
});

// =============================================================================
// getCaseWatchers
// =============================================================================

describe('getCaseWatchers', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns watchers with display names for a case', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([
      { id: 'w-1', staffUserId: 'staff-100', displayName: 'Alice', createdAt: NOW },
      { id: 'w-2', staffUserId: 'staff-200', displayName: 'Bob', createdAt: NOW },
    ]));
    const { getCaseWatchers } = await import('../helpdesk-cases');
    const result = await getCaseWatchers('case-001');
    expect(result).toHaveLength(2);
    expect(result[0]?.displayName).toBe('Alice');
    expect(result[1]?.staffUserId).toBe('staff-200');
  });

  it('returns empty array when case has no watchers', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { getCaseWatchers } = await import('../helpdesk-cases');
    const result = await getCaseWatchers('case-no-watchers');
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// getHelpdeskAgentsAndTeams (from helpdesk-agents.ts)
// =============================================================================

describe('getHelpdeskAgentsAndTeams', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns active agents and all teams', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) {
        return makeSelectChain([
          { id: 'staff-1', name: 'Alice Agent' },
          { id: 'staff-2', name: 'Bob Agent' },
        ]);
      }
      return makeSelectChain([
        { id: 'team-1', name: 'Support' },
      ]);
    });
    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    const result = await getHelpdeskAgentsAndTeams();
    expect(result.agents).toHaveLength(2);
    expect(result.teams).toHaveLength(1);
    expect(result.agents[0]?.name).toBe('Alice Agent');
    expect(result.teams[0]?.name).toBe('Support');
  });

  it('returns empty agents and teams when none exist', async () => {
    mockDbSelect.mockImplementation(() => makeSelectChain([]));
    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    const result = await getHelpdeskAgentsAndTeams();
    expect(result.agents).toHaveLength(0);
    expect(result.teams).toHaveLength(0);
  });

  it('does not filter out any agents — returns all active regardless of team membership', async () => {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
      call++;
      if (call === 1) {
        // 3 agents — none filtered by team membership
        return makeSelectChain([
          { id: 's1', name: 'Agent 1' },
          { id: 's2', name: 'Agent 2' },
          { id: 's3', name: 'Agent 3' },
        ]);
      }
      return makeSelectChain([]);
    });
    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    const result = await getHelpdeskAgentsAndTeams();
    expect(result.agents).toHaveLength(3);
  });
});
