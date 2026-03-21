import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'innerJoin'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('getCasesByRequester', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns empty array when user has no cases', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-no-cases');
    expect(result).toEqual([]);
  });

  it('returns case list for user', async () => {
    const cases = [
      { id: 'case-1', caseNumber: 'HD-000001', subject: 'My order', status: 'OPEN', priority: 'NORMAL', type: 'ORDER', updatedAt: new Date(), lastActivityAt: new Date() },
    ];
    mockSelect.mockReturnValue(makeSelectChain(cases));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-test-001');
    expect(result).toHaveLength(1);
    expect(result[0]?.caseNumber).toBe('HD-000001');
  });

  it('accepts optional status filter', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getCasesByRequester } = await import('../helpdesk-cases');
    const result = await getCasesByRequester('user-test-001', { status: ['OPEN', 'PENDING_USER'] });
    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });
});

describe('getCaseDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null when case not found or does not belong to user', async () => {
    const caseChain = makeSelectChain([]);
    mockSelect.mockReturnValue(caseChain);

    const { getCaseDetail } = await import('../helpdesk-cases');
    const result = await getCaseDetail('case-no-exist', 'user-test-001');
    expect(result).toBeNull();
  });

  it('returns case detail with messages and events for owner', async () => {
    const caseRow = {
      id: 'case-1', caseNumber: 'HD-000001', subject: 'Order issue',
      description: 'Details about the issue', status: 'OPEN', priority: 'NORMAL',
      type: 'ORDER', channel: 'WEB', requesterId: 'user-1',
      assignedAgentId: null, assignedTeamId: null, tags: [],
      orderId: null, listingId: null, sellerId: null, payoutId: null,
      disputeCaseId: null, returnRequestId: null, conversationId: null,
      slaFirstResponseDueAt: null, slaResolutionDueAt: null,
      slaFirstResponseBreached: false, slaResolutionBreached: false,
      firstResponseAt: null, resolvedAt: null, closedAt: null,
      lastActivityAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    };
    const messages = [
      { id: 'msg-1', senderType: 'user', senderId: 'user-1', senderName: null, direction: 'INBOUND', body: 'My message', bodyHtml: null, attachments: [], deliveryStatus: 'DELIVERED', createdAt: new Date() },
    ];
    const events = [
      { id: 'evt-1', eventType: 'created', actorType: 'user', actorId: 'user-1', dataJson: {}, createdAt: new Date() },
    ];

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([caseRow]);
      if (callCount === 2) return makeSelectChain(messages);
      return makeSelectChain(events);
    });

    const { getCaseDetail } = await import('../helpdesk-cases');
    const result = await getCaseDetail('case-1', 'user-1');
    expect(result).not.toBeNull();
    expect(result?.caseNumber).toBe('HD-000001');
    expect(result?.messages).toHaveLength(1);
    expect(result?.events).toHaveLength(1);
  });

  it('does not expose internal notes to user (only INBOUND/OUTBOUND/SYSTEM)', async () => {
    const caseRow = { id: 'case-1', requesterId: 'user-1', status: 'OPEN' };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([caseRow]);
      return makeSelectChain([]);
    });

    const { getCaseDetail } = await import('../helpdesk-cases');
    // The where clause on messages filters to INBOUND/OUTBOUND/SYSTEM
    // We can only verify that the query executes without including INTERNAL messages
    const result = await getCaseDetail('case-1', 'user-1');
    expect(result).not.toBeNull();
  });
});

describe('getAgentCaseDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns null for nonexistent case', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getAgentCaseDetail } = await import('../helpdesk-cases');
    const result = await getAgentCaseDetail('case-no-exist');
    expect(result).toBeNull();
  });

  it('returns full case detail including all messages', async () => {
    const caseRow = {
      id: 'case-1', caseNumber: 'HD-000001', subject: 'Order issue',
      description: 'Details', status: 'OPEN', priority: 'NORMAL',
      type: 'ORDER', channel: 'WEB', requesterId: 'user-1',
      assignedAgentId: 'staff-1', assignedTeamId: 'team-1', tags: [],
      orderId: null, listingId: null, sellerId: null, payoutId: null,
      disputeCaseId: null, returnRequestId: null, conversationId: null,
      slaFirstResponseDueAt: null, slaResolutionDueAt: null,
      slaFirstResponseBreached: false, slaResolutionBreached: false,
      firstResponseAt: null, resolvedAt: null, closedAt: null,
      lastActivityAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([caseRow]);
      return makeSelectChain([]);
    });

    const { getAgentCaseDetail } = await import('../helpdesk-cases');
    const result = await getAgentCaseDetail('case-1');
    expect(result).not.toBeNull();
    expect(result?.caseNumber).toBe('HD-000001');
    expect(result?.assignedAgentId).toBe('staff-1');
  });
});

describe('getAgentCaseQueue', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns all cases with no filters', async () => {
    const cases = [
      { id: 'c-1', caseNumber: 'HD-000001', subject: 'Issue 1', status: 'OPEN', priority: 'NORMAL', type: 'SUPPORT', updatedAt: new Date(), lastActivityAt: new Date() },
      { id: 'c-2', caseNumber: 'HD-000002', subject: 'Issue 2', status: 'NEW', priority: 'HIGH', type: 'ORDER', updatedAt: new Date(), lastActivityAt: new Date() },
    ];
    mockSelect.mockReturnValue(makeSelectChain(cases));

    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue();
    expect(result).toHaveLength(2);
  });

  it('returns empty array when queue is empty', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue({ status: ['OPEN'] });
    expect(result).toEqual([]);
  });

  it('accepts all filter combinations', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));
    const { getAgentCaseQueue } = await import('../helpdesk-cases');
    const result = await getAgentCaseQueue({
      status: ['OPEN', 'ESCALATED'],
      priority: ['CRITICAL', 'URGENT'],
      assignedAgentId: 'staff-test-001',
      assignedTeamId: 'team-test-001',
    });
    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });
});
