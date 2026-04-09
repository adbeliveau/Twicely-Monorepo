import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  helpdeskTeam: { id: 'id' },
  helpdeskTeamMember: { teamId: 'team_id', staffUserId: 'staff_user_id', isAvailable: 'is_available' },
  helpdeskMacro: { id: 'id', createdByStaffId: 'created_by_staff_id' },
  helpdeskSavedView: { id: 'id', staffUserId: 'staff_user_id' },
  helpdeskSlaPolicy: { id: 'id', firstResponseMinutes: 'first_response_minutes', resolutionMinutes: 'resolution_minutes', updatedAt: 'updated_at' },
  helpdeskAutomationRule: { id: 'id', isActive: 'is_active', updatedAt: 'updated_at' },
  helpdeskRoutingRule: { id: 'id', isActive: 'is_active', sortOrder: 'sort_order', updatedAt: 'updated_at' },
  caseWatcher: { id: 'id', caseId: 'case_id', staffUserId: 'staff_user_id' },
  staffUser: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/validations/helpdesk', () => ({
  createMacroSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d?.name && typeof d.name === 'string' && d.name.length > 0) {
        return { success: true, data: { name: d.name, description: d.description ?? null, bodyTemplate: d.bodyTemplate ?? '', actionsJson: [], isShared: false } };
      }
      return { success: false, error: { issues: [{ message: 'Name is required' }] } };
    }),
  },
  createSavedViewSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d?.name && typeof d.name === 'string' && d.name.length > 0) {
        return { success: true, data: { name: d.name, filtersJson: d.filtersJson ?? {}, sortJson: null, isDefault: false } };
      }
      return { success: false, error: { issues: [{ message: 'Name is required' }] } };
    }),
  },
}));

vi.mock('@/lib/validations/helpdesk-agent-status', () => ({
  toggleAgentOnlineStatusSchema: {
    safeParse: vi.fn((data: unknown) => {
      if (typeof (data as Record<string, unknown>)?.isOnline === 'boolean') {
        return { success: true, data };
      }
      return { success: false, error: { issues: [{ message: 'Invalid input' }] } };
    }),
  },
}));

// =============================================================================
// HELPERS
// =============================================================================

function makeAuth(canManage = true) {
  const ability = { can: vi.fn().mockReturnValue(canManage) };
  const session = {
    staffUserId: 'staff-test-1',
    displayName: 'Test Staff',
    email: 'staff@twicely.co',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function makeUnauthorized() {
  mockStaffAuthorize.mockRejectedValue(new Error('Not authenticated'));
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) };
}

function makeInsertChain(id = 'new-id') {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id }]),
    }),
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

// =============================================================================
// addTeamMember
// =============================================================================

describe('addTeamMember', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('inserts team member on success', async () => {
    makeAuth(true);
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'team-001' }]));
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const { addTeamMember } = await import('../helpdesk-agent');
    const result = await addTeamMember('team-001', 'staff-new');
    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('returns error when team not found', async () => {
    makeAuth(true);
    mockDbSelect.mockReturnValue(makeSelectChain([])); // team does not exist
    const { addTeamMember } = await import('../helpdesk-agent');
    const result = await addTeamMember('team-nonexistent', 'staff-new');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Access denied when CASL denies manage HelpdeskTeam', async () => {
    makeAuth(false);
    const { addTeamMember } = await import('../helpdesk-agent');
    const result = await addTeamMember('team-001', 'staff-new');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// removeTeamMember
// =============================================================================

describe('removeTeamMember', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deletes team membership on success', async () => {
    makeAuth(true);
    mockDbDelete.mockReturnValue(makeDeleteChain());
    const { removeTeamMember } = await import('../helpdesk-agent');
    const result = await removeTeamMember('team-001', 'staff-old');
    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies', async () => {
    makeAuth(false);
    const { removeTeamMember } = await import('../helpdesk-agent');
    const result = await removeTeamMember('team-001', 'staff-old');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// toggleTeamMemberAvailability
// =============================================================================

describe('toggleTeamMemberAvailability', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates isAvailable on success', async () => {
    makeAuth(true);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { toggleTeamMemberAvailability } = await import('../helpdesk-agent');
    const result = await toggleTeamMemberAvailability('team-001', 'staff-001', false);
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies', async () => {
    makeAuth(false);
    const { toggleTeamMemberAvailability } = await import('../helpdesk-agent');
    const result = await toggleTeamMemberAvailability('team-001', 'staff-001', true);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// toggleRoutingRule
// =============================================================================

describe('toggleRoutingRule', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates isActive on success', async () => {
    makeAuth(true);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { toggleRoutingRule } = await import('../helpdesk-agent');
    const result = await toggleRoutingRule('rule-001', true);
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies manage HelpdeskRoutingRule', async () => {
    makeAuth(false);
    const { toggleRoutingRule } = await import('../helpdesk-agent');
    const result = await toggleRoutingRule('rule-001', false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// reorderRoutingRules
// =============================================================================

describe('reorderRoutingRules', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates sortOrder for each rule id', async () => {
    makeAuth(true);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { reorderRoutingRules } = await import('../helpdesk-agent');
    const result = await reorderRoutingRules(['rule-a', 'rule-b', 'rule-c']);
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(3);
  });

  it('returns Access denied when CASL denies', async () => {
    makeAuth(false);
    const { reorderRoutingRules } = await import('../helpdesk-agent');
    const result = await reorderRoutingRules(['rule-a']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('handles empty orderedIds without error', async () => {
    makeAuth(true);
    const { reorderRoutingRules } = await import('../helpdesk-agent');
    const result = await reorderRoutingRules([]);
    expect(result.success).toBe(true);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

// =============================================================================
// createMacro
// =============================================================================

describe('createMacro', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('inserts macro and returns id on success', async () => {
    makeAuth(true);
    mockDbInsert.mockReturnValue(makeInsertChain('macro-new'));
    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: 'Refund Macro', bodyTemplate: 'Dear customer...' });
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.id).toBe('macro-new');
    }
  });

  it('returns validation error when name is missing', async () => {
    makeAuth(true);
    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns Access denied when CASL denies manage HelpdeskMacro', async () => {
    makeAuth(false);
    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: 'Test Macro' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('returns Insert failed when DB returns no rows', async () => {
    makeAuth(true);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]), // no row returned
      }),
    });
    const { createMacro } = await import('../helpdesk-agent');
    const result = await createMacro({ name: 'Orphan Macro', bodyTemplate: '...' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insert failed');
  });
});

// =============================================================================
// deleteMacro
// =============================================================================

describe('deleteMacro', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deletes macro on success', async () => {
    makeAuth(true);
    mockDbDelete.mockReturnValue(makeDeleteChain());
    const { deleteMacro } = await import('../helpdesk-agent');
    const result = await deleteMacro('macro-001');
    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies', async () => {
    makeAuth(false);
    const { deleteMacro } = await import('../helpdesk-agent');
    const result = await deleteMacro('macro-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// createSavedView
// =============================================================================

describe('createSavedView', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('inserts saved view and returns id on success', async () => {
    makeAuth(true);
    mockDbInsert.mockReturnValue(makeInsertChain('view-new'));
    const { createSavedView } = await import('../helpdesk-agent');
    const result = await createSavedView({ name: 'My CRITICAL view', filtersJson: { priority: 'CRITICAL' } });
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.id).toBe('view-new');
    }
  });

  it('returns validation error when name is missing', async () => {
    makeAuth(true);
    const { createSavedView } = await import('../helpdesk-agent');
    const result = await createSavedView({ name: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns Access denied when CASL denies (ability.can returns false)', async () => {
    makeAuth(false);
    const { createSavedView } = await import('../helpdesk-agent');
    const result = await createSavedView({ name: 'My View' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// deleteSavedView — ownership check
// =============================================================================

describe('deleteSavedView', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deletes saved view when owner matches session', async () => {
    const { session } = makeAuth(true);
    mockDbSelect.mockReturnValue(makeSelectChain([{ staffUserId: session.staffUserId }]));
    mockDbDelete.mockReturnValue(makeDeleteChain());
    const { deleteSavedView } = await import('../helpdesk-agent');
    const result = await deleteSavedView('view-001');
    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it('returns Not found when view does not exist', async () => {
    makeAuth(true);
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { deleteSavedView } = await import('../helpdesk-agent');
    const result = await deleteSavedView('view-ghost');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Access denied when view belongs to different staff user', async () => {
    makeAuth(true); // session.staffUserId = 'staff-test-1'
    mockDbSelect.mockReturnValue(makeSelectChain([{ staffUserId: 'staff-other-999' }]));
    const { deleteSavedView } = await import('../helpdesk-agent');
    const result = await deleteSavedView('view-other');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// updateSlaPolicyTargets
// =============================================================================

describe('updateSlaPolicyTargets', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates SLA targets on success', async () => {
    makeAuth(true);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { updateSlaPolicyTargets } = await import('../helpdesk-agent');
    const result = await updateSlaPolicyTargets('policy-001', 60, 480);
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies manage HelpdeskSlaPolicy', async () => {
    makeAuth(false);
    const { updateSlaPolicyTargets } = await import('../helpdesk-agent');
    const result = await updateSlaPolicyTargets('policy-001', 60, 480);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// toggleAutomationRule
// =============================================================================

describe('toggleAutomationRule', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('updates isActive on success', async () => {
    makeAuth(true);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const { toggleAutomationRule } = await import('../helpdesk-agent');
    const result = await toggleAutomationRule('rule-auto-001', true);
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies manage HelpdeskAutomationRule', async () => {
    makeAuth(false);
    const { toggleAutomationRule } = await import('../helpdesk-agent');
    const result = await toggleAutomationRule('rule-auto-001', false);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// addCaseWatcher / removeCaseWatcher
// =============================================================================

describe('addCaseWatcher', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('inserts watcher on success', async () => {
    makeAuth(true);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const { addCaseWatcher } = await import('../helpdesk-watchers');
    const result = await addCaseWatcher('case-001', 'staff-watcher-1');
    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies manage HelpdeskCase', async () => {
    makeAuth(false);
    const { addCaseWatcher } = await import('../helpdesk-watchers');
    const result = await addCaseWatcher('case-001', 'staff-watcher-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

describe('removeCaseWatcher', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deletes watcher on success', async () => {
    makeAuth(true);
    mockDbDelete.mockReturnValue(makeDeleteChain());
    const { removeCaseWatcher } = await import('../helpdesk-watchers');
    const result = await removeCaseWatcher('case-001', 'staff-watcher-1');
    expect(result.success).toBe(true);
    expect(mockDbDelete).toHaveBeenCalled();
  });

  it('returns Access denied when CASL denies', async () => {
    makeAuth(false);
    const { removeCaseWatcher } = await import('../helpdesk-watchers');
    const result = await removeCaseWatcher('case-001', 'staff-watcher-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied');
  });
});

// =============================================================================
// Auth propagation — staffAuthorize throws
// =============================================================================

describe('helpdesk-agent auth propagation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('addTeamMember propagates staffAuthorize error', async () => {
    makeUnauthorized();
    const { addTeamMember } = await import('../helpdesk-agent');
    await expect(addTeamMember('team-001', 'staff-new')).rejects.toThrow('Not authenticated');
  });

  it('removeCaseWatcher propagates staffAuthorize error', async () => {
    makeUnauthorized();
    const { removeCaseWatcher } = await import('../helpdesk-watchers');
    await expect(removeCaseWatcher('case-001', 'staff-1')).rejects.toThrow('Not authenticated');
  });
});
