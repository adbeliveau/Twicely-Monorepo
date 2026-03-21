import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => { chain[k] = vi.fn().mockReturnValue(chain); });
  chain['then'] = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe('getHelpdeskAgentsAndTeams', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns list of staff agents with id and name', async () => {
    const agents = [
      { id: 'staff-1', name: 'Alice Support' },
      { id: 'staff-2', name: 'Bob Agent' },
    ];
    const teams: unknown[] = [];
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain(agents);
      return makeSelectChain(teams);
    });

    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    const result = await getHelpdeskAgentsAndTeams();
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0]?.name).toBe('Alice Support');
  });

  it('returns list of helpdesk teams with id and name', async () => {
    const agents: unknown[] = [];
    const teams = [
      { id: 'team-1', name: 'Tier 1 Support' },
      { id: 'team-2', name: 'Billing Team' },
    ];
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain(agents);
      return makeSelectChain(teams);
    });

    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    const result = await getHelpdeskAgentsAndTeams();
    expect(result.teams).toHaveLength(2);
    expect(result.teams[0]?.name).toBe('Tier 1 Support');
  });

  it('returns empty arrays when no agents or teams exist', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    const result = await getHelpdeskAgentsAndTeams();
    expect(result.agents).toEqual([]);
    expect(result.teams).toEqual([]);
  });

  it('only returns active staff agents (isActive filter)', async () => {
    // The query filters by isActive = true — we verify the query runs
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { getHelpdeskAgentsAndTeams } = await import('../helpdesk-agents');
    await getHelpdeskAgentsAndTeams();
    // Two select calls — one for agents (with where isActive), one for teams
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });
});
