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

function makeLeadSession() {
  return {
    session: {
      staffUserId: 'staff-test-lead',
      displayName: 'Lead',
      email: 'lead@twicely.co',
      isPlatformStaff: true as const,
      platformRoles: ['HELPDESK_LEAD' as const],
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

// ─── Macros ───────────────────────────────────────────────────────────────────

describe('createMacro', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent (not lead)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: 'Test Macro', bodyTemplate: 'Template body text' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns validation error for empty name', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: '', bodyTemplate: 'Template body' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('creates macro and returns id', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const insertChain = makeChain([{ id: 'macro-test-001' }]);
    mockInsert.mockReturnValue(insertChain);

    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: 'Return Approval', bodyTemplate: 'Hi {{buyer_name}}, your return has been approved.' });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('macro-test-001');
  });
});

describe('deleteMacro', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { deleteMacro } = await import('../helpdesk-agent');
    const result = await deleteMacro('macro-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('deletes macro when lead authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeLeadSession());
    const deleteChain = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValue(deleteChain);

    const { deleteMacro } = await import('../helpdesk-agent');
    const result = await deleteMacro('macro-test-001');
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

// ─── Saved Views ──────────────────────────────────────────────────────────────

describe('createSavedView', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied when cannot read HelpdeskSavedView', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { createSavedView } = await import('../helpdesk-agent');
    const result = await createSavedView({ name: 'My View', filtersJson: {} });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns validation error for missing filtersJson', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const { createSavedView } = await import('../helpdesk-agent');
    const result = await createSavedView({ name: 'My View' });
    expect(result.success).toBe(false);
  });

  it('creates saved view when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const insertChain = makeChain([{ id: 'view-test-001' }]);
    mockInsert.mockReturnValue(insertChain);

    const { createSavedView } = await import('../helpdesk-agent');
    const result = await createSavedView({ name: 'Open Cases', filtersJson: { status: 'OPEN' } });
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('view-test-001');
  });
});

describe('deleteSavedView', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns not found for missing view', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);

    const { deleteSavedView } = await import('../helpdesk-agent');
    const result = await deleteSavedView('view-no-exist');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns access denied when view belongs to another agent', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ staffUserId: 'staff-other-agent' }]),
    };
    mockSelect.mockReturnValue(selectChain);

    const { deleteSavedView } = await import('../helpdesk-agent');
    const result = await deleteSavedView('view-belongs-to-other');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('deletes view when owned by the requesting staff', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ staffUserId: 'staff-test-mgr' }]),
    };
    mockSelect.mockReturnValue(selectChain);
    const deleteChain = { where: vi.fn().mockResolvedValue([]) };
    mockDelete.mockReturnValue(deleteChain);

    const { deleteSavedView } = await import('../helpdesk-agent');
    const result = await deleteSavedView('view-test-001');
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

// ─── SLA & Automation ─────────────────────────────────────────────────────────

describe('updateSlaPolicyTargets', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { updateSlaPolicyTargets } = await import('../helpdesk-agent');
    const result = await updateSlaPolicyTargets('policy-1', 60, 480);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('updates SLA policy when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { updateSlaPolicyTargets } = await import('../helpdesk-agent');
    const result = await updateSlaPolicyTargets('policy-1', 60, 480);
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ firstResponseMinutes: 60, resolutionMinutes: 480 })
    );
  });
});

describe('toggleAutomationRule', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns access denied for non-manager', async () => {
    mockStaffAuthorize.mockResolvedValue(makeAgentSession());
    const { toggleAutomationRule } = await import('../helpdesk-agent');
    const result = await toggleAutomationRule('rule-1', true);
    expect(result.success).toBe(false);
  });

  it('enables automation rule when authorized', async () => {
    mockStaffAuthorize.mockResolvedValue(makeManagerSession());
    const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
    mockUpdate.mockReturnValue(updateChain);

    const { toggleAutomationRule } = await import('../helpdesk-agent');
    const result = await toggleAutomationRule('rule-1', true);
    expect(result.success).toBe(true);
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });
});
