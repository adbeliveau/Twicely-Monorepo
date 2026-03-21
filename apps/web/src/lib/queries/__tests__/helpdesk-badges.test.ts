import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

const AGENT_ID = 'staff-test-001';

function makeCountChain(countValue: number) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) =>
      Promise.resolve([{ count: countValue }]).then(resolve),
  };
  ['from', 'where'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('getHelpdeskBadges', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns non-zero allCases when open cases exist', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCountChain(5); // allCases
      if (callCount === 2) return makeCountChain(2); // myOpen
      if (callCount === 3) return makeCountChain(1); // unassigned
      if (callCount === 4) return makeCountChain(1); // emailInbox
      if (callCount === 5) return makeCountChain(0); // slaBreach
      if (callCount === 6) return makeCountChain(2); // pending
      return makeCountChain(1);                       // escalated
    });

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.allCases).toBe(5);
  });

  it('returns zero for all counts when no cases exist', async () => {
    mockSelect.mockImplementation(() => makeCountChain(0));

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.allCases).toBe(0);
    expect(result.myOpen).toBe(0);
    expect(result.unassigned).toBe(0);
    expect(result.emailInbox).toBe(0);
    expect(result.slaBreach).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.escalated).toBe(0);
  });

  it('myOpen counts only cases assigned to given agent', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCountChain(10); // allCases (not filtered by agent)
      if (callCount === 2) return makeCountChain(3);  // myOpen (filtered by agentId)
      return makeCountChain(0);
    });

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.allCases).toBe(10);
    expect(result.myOpen).toBe(3);
  });

  it('unassigned counts only cases with null assignedAgentId', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCountChain(8);  // allCases
      if (callCount === 2) return makeCountChain(2);  // myOpen
      if (callCount === 3) return makeCountChain(4);  // unassigned
      return makeCountChain(0);
    });

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.unassigned).toBe(4);
  });

  it('slaBreach counts only cases with slaFirstResponseBreached=true', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCountChain(6);  // allCases
      if (callCount === 2) return makeCountChain(1);  // myOpen
      if (callCount === 3) return makeCountChain(2);  // unassigned
      if (callCount === 4) return makeCountChain(1);  // emailInbox
      if (callCount === 5) return makeCountChain(3);  // slaBreach
      return makeCountChain(0);
    });

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.slaBreach).toBe(3);
  });

  it('pending counts PENDING_USER and PENDING_INTERNAL', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCountChain(7);  // allCases
      if (callCount === 2) return makeCountChain(0);  // myOpen
      if (callCount === 3) return makeCountChain(0);  // unassigned
      if (callCount === 4) return makeCountChain(0);  // emailInbox
      if (callCount === 5) return makeCountChain(0);  // slaBreach
      if (callCount === 6) return makeCountChain(4);  // pending
      return makeCountChain(0);
    });

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.pending).toBe(4);
  });

  it('escalated counts only ESCALATED status', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeCountChain(5);  // allCases
      if (callCount === 2) return makeCountChain(0);  // myOpen
      if (callCount === 3) return makeCountChain(0);  // unassigned
      if (callCount === 4) return makeCountChain(0);  // emailInbox
      if (callCount === 5) return makeCountChain(0);  // slaBreach
      if (callCount === 6) return makeCountChain(0);  // pending
      return makeCountChain(2);                        // escalated
    });

    const { getHelpdeskBadges } = await import('../helpdesk-badges');
    const result = await getHelpdeskBadges(AGENT_ID);
    expect(result.escalated).toBe(2);
  });
});
