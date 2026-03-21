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

const BASE_CASE = {
  id: 'case-test-001',
  requesterId: 'user-test-001',
  orderId: null as string | null,
  assignedAgentId: null as string | null,
  assignedTeamId: null as string | null,
  slaFirstResponseDueAt: null as Date | null,
  slaResolutionDueAt: null as Date | null,
  firstResponseAt: null as Date | null,
  resolvedAt: null as Date | null,
  tags: [] as string[] | null,
};

describe('getCaseContext', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns valid context for case with all links', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ name: 'Alice', email: 'alice@test.com', displayName: 'Alice B' }]);
      if (callCount === 2) return makeSelectChain([{ id: 'order-1', orderNumber: 'TWC-10001', status: 'DELIVERED', totalCents: 5000 }]);
      if (callCount === 3) return makeSelectChain([{ displayName: 'Agent Smith' }]);
      if (callCount === 4) return makeSelectChain([{ name: 'Order Support' }]);
      if (callCount === 5) return makeSelectChain([]);
      // requester stats: orderCount, caseCount
      if (callCount === 6) return makeSelectChain([{ count: 3 }]);
      return makeSelectChain([{ count: 1 }]);
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext({
      ...BASE_CASE,
      orderId: 'order-1',
      assignedAgentId: 'agent-1',
      assignedTeamId: 'team-1',
      tags: ['shipping'],
    });

    expect(result.requesterName).toBe('Alice B');
    expect(result.requesterEmail).toBe('alice@test.com');
    expect(result.order?.orderNumber).toBe('TWC-10001');
    expect(result.assignedAgentName).toBe('Agent Smith');
    expect(result.assignedTeamName).toBe('Order Support');
    expect(result.tags).toEqual(['shipping']);
  });

  it('returns valid context for case with null tags', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ name: 'Bob', email: 'bob@test.com', displayName: null }]);
      if (callCount === 2) return makeSelectChain([]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([{ count: 0 }]);
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext({ ...BASE_CASE, tags: null });
    expect(result.tags).toEqual([]);
  });

  it('returns valid context for case with no linked order', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ name: 'Carol', email: 'carol@test.com', displayName: 'Carol C' }]);
      if (callCount === 2) return makeSelectChain([]);
      if (callCount === 3) return makeSelectChain([{ count: 2 }]);
      return makeSelectChain([{ count: 0 }]);
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext({ ...BASE_CASE, orderId: null });
    expect(result.order).toBeUndefined();
    expect(result.requesterName).toBe('Carol C');
  });

  it('returns valid context for case with no assigned agent', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ name: 'Dave', email: 'dave@test.com', displayName: 'Dave D' }]);
      if (callCount === 2) return makeSelectChain([]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([{ count: 0 }]);
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext({ ...BASE_CASE, assignedAgentId: null });
    expect(result.assignedAgentName).toBeUndefined();
    expect(result.assignedAgentId).toBeNull();
  });

  it('requesterStats returns zero counts for new requester', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ name: 'Eve', email: 'eve@test.com', displayName: 'Eve E' }]);
      if (callCount === 2) return makeSelectChain([]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([{ count: 0 }]);
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext(BASE_CASE);
    expect(result.requesterStats?.orderCount).toBe(0);
    expect(result.requesterStats?.caseCount).toBe(0);
    expect(result.requesterStats?.disputeCount).toBe(0);
  });

  it('previousCases returns empty array for first-time requester', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ name: 'Frank', email: 'frank@test.com', displayName: null }]);
      if (callCount === 2) return makeSelectChain([]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([{ count: 0 }]);
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext(BASE_CASE);
    expect(result.previousCases).toEqual([]);
  });

  it('handles database error gracefully and returns safe default', async () => {
    mockSelect.mockImplementation(() => {
      throw new Error('DB connection lost');
    });

    const { getCaseContext } = await import('../helpdesk-context');
    const result = await getCaseContext(BASE_CASE);
    expect(result.tags).toEqual([]);
    expect(result.requesterName).toBeUndefined();
    expect(result.requesterEmail).toBeUndefined();
  });
});
