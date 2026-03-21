import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('evaluateRoutingRules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  const BASIC_INPUT = {
    type: 'ORDER' as const,
    priority: 'NORMAL' as const,
    channel: 'WEB' as const,
    subject: 'My order has not arrived',
    requesterType: 'user',
  };

  it('routes to default team when no rules match', async () => {
    // No routing rules
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([]); // no routing rules
      if (callCount === 2) return makeSelectChain([{ id: 'team-default' }]); // default team
      return makeSelectChain([]); // no available agents
    });

    const { evaluateRoutingRules } = await import('../routing');
    const result = await evaluateRoutingRules(BASIC_INPUT);
    expect(result.assignedTeamId).toBe('team-default');
    expect(result.assignedAgentId).toBeNull();
    expect(result.priority).toBe('NORMAL');
  });

  it('returns null teamId and agentId when no default team exists', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([]); // no routing rules
      return makeSelectChain([]); // no default team
    });

    const { evaluateRoutingRules } = await import('../routing');
    const result = await evaluateRoutingRules(BASIC_INPUT);
    expect(result.assignedTeamId).toBeNull();
    expect(result.assignedAgentId).toBeNull();
  });

  it('matches first rule with eq operator and assigns team', async () => {
    const matchingRule = {
      id: 'rule-1',
      isActive: true,
      sortOrder: 0,
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'ORDER' }],
      actionsJson: { assignTeamId: 'team-orders', setPriority: 'HIGH' },
    };

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([matchingRule]);
      return makeSelectChain([]); // no agents available
    });

    const { evaluateRoutingRules } = await import('../routing');
    const result = await evaluateRoutingRules(BASIC_INPUT);
    expect(result.assignedTeamId).toBe('team-orders');
    expect(result.priority).toBe('HIGH');
  });

  it('matches rule with contains operator on subject', async () => {
    const rule = {
      id: 'rule-2', isActive: true, sortOrder: 0,
      conditionsJson: [{ field: 'subject', operator: 'contains', value: 'not arrived' }],
      actionsJson: { assignTeamId: 'team-shipping', addTags: ['shipping-issue'] },
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([rule]);
      return makeSelectChain([]);
    });

    const { evaluateRoutingRules } = await import('../routing');
    const result = await evaluateRoutingRules({ ...BASIC_INPUT, subject: 'My order has not arrived' });
    expect(result.assignedTeamId).toBe('team-shipping');
    expect(result.tags).toContain('shipping-issue');
  });

  it('does not match rule when condition field does not match', async () => {
    const rule = {
      id: 'rule-3', isActive: true, sortOrder: 0,
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'BILLING' }],
      actionsJson: { assignTeamId: 'team-billing' },
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([rule]); // rule for BILLING type
      if (callCount === 2) return makeSelectChain([{ id: 'team-default' }]);
      return makeSelectChain([]);
    });

    const { evaluateRoutingRules } = await import('../routing');
    // INPUT type is ORDER, so rule doesn't match
    const result = await evaluateRoutingRules(BASIC_INPUT);
    // Falls through to default team
    expect(result.assignedTeamId).toBe('team-default');
  });

  it('round-robin picks least-loaded agent in team', async () => {
    const rule = {
      id: 'rule-1', isActive: true, sortOrder: 0,
      conditionsJson: [{ field: 'type', operator: 'eq', value: 'ORDER' }],
      actionsJson: { assignTeamId: 'team-orders' },
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([rule]);
      // Round-robin query returns least-loaded agent
      return makeSelectChain([{ staffUserId: 'staff-least-loaded', activeCaseCount: 2 }]);
    });

    const { evaluateRoutingRules } = await import('../routing');
    const result = await evaluateRoutingRules(BASIC_INPUT);
    expect(result.assignedAgentId).toBe('staff-least-loaded');
  });

  it('handles neq operator correctly', async () => {
    const rule = {
      id: 'rule-neq', isActive: true, sortOrder: 0,
      conditionsJson: [{ field: 'type', operator: 'neq', value: 'BILLING' }],
      actionsJson: { assignTeamId: 'team-general' },
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([rule]);
      return makeSelectChain([]);
    });

    const { evaluateRoutingRules } = await import('../routing');
    // ORDER type !== BILLING → matches
    const result = await evaluateRoutingRules(BASIC_INPUT);
    expect(result.assignedTeamId).toBe('team-general');
  });

  it('handles in operator for channel matching', async () => {
    const rule = {
      id: 'rule-in', isActive: true, sortOrder: 0,
      conditionsJson: [{ field: 'channel', operator: 'in', value: ['WEB', 'EMAIL'] }],
      actionsJson: { assignTeamId: 'team-web' },
    };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([rule]);
      return makeSelectChain([]);
    });

    const { evaluateRoutingRules } = await import('../routing');
    const result = await evaluateRoutingRules(BASIC_INPUT);
    expect(result.assignedTeamId).toBe('team-web');
  });
});
