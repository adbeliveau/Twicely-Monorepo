import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect, delete: mockDelete };
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

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

function makeManagerSession() {
  return {
    session: {
      staffUserId: 'staff-test-mgr',
      displayName: 'Manager',
      email: 'mgr@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_MANAGER' as const],
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeAgentSession() {
  return {
    session: {
      staffUserId: 'staff-test-agent',
      displayName: 'Agent',
      email: 'agent@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_AGENT' as const],
    },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

// ─── Team management ──────────────────────────────────────────────────────────

describe('addTeamMember', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('throws when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    const { addTeamMember } = await import('../helpdesk-agent');
    await expect(addTeamMember('team-1', 'staff-1')).rejects.toThrow('Forbidden');
  });

  it('returns access denied when ability.can returns false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { addTeamMember } = await import('../helpdesk-agent');
    const result = await addTeamMember('team-1', 'staff-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns not found for missing team', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);
    const { addTeamMember } = await import('../helpdesk-agent');
    const result = await addTeamMember('team-no-exist', 'staff-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('inserts team member when team exists', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'team-1' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { addTeamMember } = await import('../helpdesk-agent');
    const result = await addTeamMember('team-1', 'staff-new');
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe('removeTeamMember', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { removeTeamMember } = await import('../helpdesk-agent');
    const result = await removeTeamMember('team-1', 'staff-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('deletes team member when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const deleteChain = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValue(deleteChain);

    const { removeTeamMember } = await import('../helpdesk-agent');
    const result = await removeTeamMember('team-1', 'staff-1');
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('toggleTeamMemberAvailability', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { toggleTeamMemberAvailability } = await import('../helpdesk-agent');
    const result = await toggleTeamMemberAvailability('team-1', 'staff-1', false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('updates availability when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { toggleTeamMemberAvailability } = await import('../helpdesk-agent');
    const result = await toggleTeamMemberAvailability('team-1', 'staff-1', true);
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith({ isAvailable: true });
  });
});

// ─── Routing rules ────────────────────────────────────────────────────────────

describe('toggleRoutingRule', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { toggleRoutingRule } = await import('../helpdesk-agent');
    const result = await toggleRoutingRule('rule-1', true);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('sets rule to active when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { toggleRoutingRule } = await import('../helpdesk-agent');
    const result = await toggleRoutingRule('rule-1', true);
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });
});

describe('reorderRoutingRules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates sort order for each rule id', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { reorderRoutingRules } = await import('../helpdesk-agent');
    const result = await reorderRoutingRules(['rule-a', 'rule-b', 'rule-c']);
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });
});

// ─── Watchers ─────────────────────────────────────────────────────────────────

describe('addCaseWatcher / removeCaseWatcher', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('addCaseWatcher throws when not staff', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    const { addCaseWatcher } = await import('../helpdesk-watchers');
    await expect(addCaseWatcher('case-1', 'staff-1')).rejects.toThrow('Forbidden');
  });

  it('addCaseWatcher inserts watcher when authenticated', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const insertChain = makeChain([]);
    mockInsert.mockReturnValue(insertChain);

    const { addCaseWatcher } = await import('../helpdesk-watchers');
    const result = await addCaseWatcher('case-test-001', 'staff-test-mgr');
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('removeCaseWatcher deletes watcher record', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const deleteChain = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValue(deleteChain);

    const { removeCaseWatcher } = await import('../helpdesk-watchers');
    const result = await removeCaseWatcher('case-test-001', 'staff-test-mgr');
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});
