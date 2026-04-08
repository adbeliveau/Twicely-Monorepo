import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockUpdate, mockSelect, mockDelete, mockStaffAuthorize, mockCalculateSlaDue } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
  mockStaffAuthorize: vi.fn(),
  mockCalculateSlaDue: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete },
}));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('@/lib/helpdesk/sla', () => ({ calculateSlaDue: mockCalculateSlaDue }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  addAgentReply,
  assignCase,
} from '../helpdesk-agent-cases';
import { updateCasePriority, updateCaseTags } from '../helpdesk-agent-cases-meta';

// Valid cuid2 test IDs
const CASE_ID = 'cljd4bvd00000wjh07mcy26x';
const AGENT_ID = 'cljd4bvd00001wjh07mcy26y';
const TEAM_ID = 'cljd4bvd00002wjh07mcy26z';
const AGENT_ID_OLD = 'cljd4bvd00003wjh07mcy270';
const TEAM_ID_OLD = 'cljd4bvd00004wjh07mcy271';

function makeChain(returnVal: unknown) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnVal),
    returning: vi.fn().mockResolvedValue(returnVal),
  };
  Object.defineProperty(chain, 'then', {
    get() { return (res: (v: unknown) => void) => Promise.resolve(returnVal).then(res); },
  });
  return chain;
}

function makeStaffSession(overrides = {}) {
  return {
    session: {
      staffUserId: 'staff-test-001',
      displayName: 'Test Agent',
      email: 'agent@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_AGENT' as const],
      ...overrides,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

describe('addAgentReply', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('throws when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    await expect(addAgentReply({ caseId: CASE_ID, body: 'reply' })).rejects.toThrow('Forbidden');
  });

  it('returns validation error for missing caseId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const result = await addAgentReply({ body: 'Reply body here' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns not found for missing case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);
    const result = await addAgentReply({ caseId: CASE_ID, body: 'Reply' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('sets firstResponseAt on first outbound reply', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, firstResponseAt: null, requesterId: 'user-1' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const result = await addAgentReply({ caseId: CASE_ID, body: 'Here is my agent reply.', isInternal: false });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ firstResponseAt: expect.any(Date) })
    );
  });

  it('does not set firstResponseAt for internal notes', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, firstResponseAt: null, requesterId: 'user-1' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    await addAgentReply({ caseId: CASE_ID, body: 'Internal note for team', isInternal: true });
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.firstResponseAt).toBeUndefined();
  });

  it('skips firstResponseAt when already set', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const alreadyResponded = new Date();
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, firstResponseAt: alreadyResponded, requesterId: 'user-1', status: 'OPEN' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    await addAgentReply({ caseId: CASE_ID, body: 'Follow-up reply', isInternal: false });
    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg?.firstResponseAt).toBeUndefined();
  });

});

describe('assignCase', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('throws when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    await expect(assignCase({ caseId: CASE_ID, assignedAgentId: null, assignedTeamId: null })).rejects.toThrow('Forbidden');
  });

  it('returns not found for nonexistent case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);
    const result = await assignCase({ caseId: CASE_ID, assignedAgentId: null, assignedTeamId: null });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('decrements old agent count and increments new agent count', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ assignedAgentId: AGENT_ID_OLD, assignedTeamId: TEAM_ID_OLD }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const result = await assignCase({ caseId: CASE_ID, assignedAgentId: AGENT_ID, assignedTeamId: TEAM_ID });
    expect(result.success).toBe(true);
    // 3 update calls: decrement old, increment new, update case
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it('skips decrement when case had no previous agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ assignedAgentId: null, assignedTeamId: null }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    await assignCase({ caseId: CASE_ID, assignedAgentId: AGENT_ID, assignedTeamId: TEAM_ID });
    // Only 2 updates: increment new, update case
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});

describe('updateCasePriority', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns not found for nonexistent case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);
    const result = await updateCasePriority({ caseId: CASE_ID, priority: 'HIGH' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('recalculates SLA dates on priority change', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const createdAt = new Date('2026-03-01T09:00:00Z');
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: CASE_ID, priority: 'NORMAL', createdAt }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const newSla = {
      firstResponseDue: new Date(createdAt.getTime() + 4 * 60 * 60 * 1000),
      resolutionDue: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    };
    mockCalculateSlaDue.mockResolvedValue(newSla);
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const result = await updateCasePriority({ caseId: CASE_ID, priority: 'URGENT' });
    expect(result.success).toBe(true);
    expect(mockCalculateSlaDue).toHaveBeenCalledWith('URGENT', createdAt);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'URGENT',
        slaFirstResponseDueAt: newSla.firstResponseDue,
        slaResolutionDueAt: newSla.resolutionDue,
      })
    );
  });
});

describe('updateCaseTags', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns validation error for invalid input', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const result = await updateCaseTags({ caseId: CASE_ID, tags: 'not-an-array' });
    expect(result.success).toBe(false);
  });

  it('updates tags and inserts event', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const result = await updateCaseTags({ caseId: CASE_ID, tags: ['billing', 'refund'] });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['billing', 'refund'] })
    );
    expect(mockInsert).toHaveBeenCalled();
  });

  it('accepts empty tags array', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const result = await updateCaseTags({ caseId: CASE_ID, tags: [] });
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
  });
});
