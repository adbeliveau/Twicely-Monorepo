import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { update: mockDbUpdate, insert: mockDbInsert, select: mockDbSelect },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((col) => ({ isNull: col })),
  count: vi.fn(() => ({ count: 'count' })),
}));

vi.mock('@twicely/db/schema', () => ({
  customRole: {
    id: 'id', name: 'name', code: 'code', description: 'description',
    permissionsJson: 'permissions_json', isActive: 'is_active',
    createdByStaffId: 'created_by_staff_id', updatedByStaffId: 'updated_by_staff_id',
    updatedAt: 'updated_at',
  },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('@twicely/casl/permission-registry', () => ({
  validatePermissions: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockRequireMfa = vi.fn().mockResolvedValue(null);
vi.mock('../staff-mfa', () => ({
  requireMfaForCriticalAction: (...args: unknown[]) => mockRequireMfa(...args),
}));

// ─── Chain helpers ─────────────────────────────────────────────────────────────

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}
function makeInsertChainWithReturn(returnId = 'new-role-001') {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: returnId }]) }) };
}
function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}
function makeSelectChain(result: unknown[]) {
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(result) }) }) };
}
function makeSelectCountChain(countVal: number) {
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: countVal }]) }) };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function mockSuperAdmin() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId: 'super-001',
    email: 'super@hub.twicely.co',
    displayName: 'Super Admin',
    isPlatformStaff: true as const,
    platformRoles: ['SUPER_ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function mockAdminOnly() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  const session = {
    staffUserId: 'admin-001',
    email: 'admin@hub.twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  mockStaffAuthorize.mockResolvedValue({
    ability,
    session: { staffUserId: 'x', email: 'x@x.com', displayName: 'X', isPlatformStaff: true, platformRoles: ['SUPPORT'] },
  });
}

// ─── createCustomRoleAction ───────────────────────────────────────────────────

describe('createCustomRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies manage on CustomRole', async () => {
    mockForbidden();
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Test Role', permissions: [] }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Forbidden when caller is ADMIN but not SUPER_ADMIN', async () => {
    mockAdminOnly();
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Test Role', permissions: [] }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for name under 3 chars', async () => {
    mockSuperAdmin();
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'AB', permissions: [] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for name over 50 chars', async () => {
    mockSuperAdmin();
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'A'.repeat(51), permissions: [] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for name with special characters', async () => {
    mockSuperAdmin();
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Bad!Name', permissions: [] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via .strict()', async () => {
    mockSuperAdmin();
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Valid Name', permissions: [], extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns error when max 20 custom roles reached', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectCountChain(20));
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Valid Name', permissions: [] }))
      .toEqual({ error: 'Maximum 20 custom roles allowed' });
  });

  it('returns error for duplicate name', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'existing-001' }]));
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Valid Name', permissions: [] }))
      .toEqual({ error: 'A role with this name already exists' });
  });

  it('returns error for duplicate code', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'existing-001' }]));
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({ name: 'Valid Name', permissions: [] }))
      .toEqual({ error: 'A role with this code already exists' });
  });

  it('validates permissions against registry (rejects invalid subject)', async () => {
    const { validatePermissions } = await import('@/lib/casl/permission-registry');
    vi.mocked(validatePermissions).mockReturnValueOnce({
      valid: false,
      errors: ['Invalid permission: BadSubject.read'],
    });
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    expect(await createCustomRoleAction({
      name: 'Valid Name',
      permissions: [{ subject: 'BadSubject', action: 'read' }],
    })).toEqual({ error: 'Invalid permission: BadSubject.read' });
  });

  it('creates custom role and audit event on success', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const roleInsert = makeInsertChainWithReturn('new-role-001');
    const auditInsert = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(roleInsert);
    mockDbInsert.mockReturnValueOnce(auditInsert);
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    const result = await createCustomRoleAction({ name: 'Valid Name', permissions: [] });
    expect(result).toEqual({ success: true, customRoleId: 'new-role-001' });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    const auditValues = auditInsert.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('CREATE_CUSTOM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.actorType).toBe('STAFF');
  });

  it('auto-generates code from name in UPPER_SNAKE_CASE', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const roleInsert = makeInsertChainWithReturn('new-role-002');
    mockDbInsert.mockReturnValueOnce(roleInsert);
    mockDbInsert.mockReturnValueOnce(makeInsertChain());
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    await createCustomRoleAction({ name: 'Returns Specialist', permissions: [] });
    const insertValues = roleInsert.values.mock.calls[0]![0];
    expect(insertValues.code).toBe('RETURNS_SPECIALIST');
  });
});

// ─── updateCustomRoleAction ───────────────────────────────────────────────────

describe('updateCustomRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when not SUPER_ADMIN', async () => {
    mockAdminOnly();
    const { updateCustomRoleAction } = await import('../admin-custom-roles');
    expect(await updateCustomRoleAction({ customRoleId: 'role-001', name: 'New Name' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error for non-existent custom role', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { updateCustomRoleAction } = await import('../admin-custom-roles');
    expect(await updateCustomRoleAction({ customRoleId: 'missing-001' }))
      .toEqual({ error: 'Custom role not found' });
  });

  it('updates name without changing code', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      id: 'role-001', name: 'Old Name', code: 'OLD_CODE',
      description: null, permissionsJson: [],
    }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);
    mockDbInsert.mockReturnValueOnce(makeInsertChain());
    const { updateCustomRoleAction } = await import('../admin-custom-roles');
    const result = await updateCustomRoleAction({ customRoleId: 'role-001', name: 'New Name' });
    expect(result).toEqual({ success: true });
    const updateArgs = updateChain.set.mock.calls[0]![0];
    expect(updateArgs.code).toBeUndefined();
  });

  it('updates permissions with validation', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      id: 'role-001', name: 'Role', code: 'ROLE',
      description: null, permissionsJson: [],
    }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValueOnce(makeInsertChain());
    const { updateCustomRoleAction } = await import('../admin-custom-roles');
    const result = await updateCustomRoleAction({
      customRoleId: 'role-001',
      permissions: [{ subject: 'Order', action: 'read' }],
    });
    expect(result).toEqual({ success: true });
  });

  it('creates CRITICAL audit event with before/after diff', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      id: 'role-001', name: 'Old Name', code: 'OLD_CODE',
      description: null, permissionsJson: [],
    }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditInsert = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditInsert);
    const { updateCustomRoleAction } = await import('../admin-custom-roles');
    await updateCustomRoleAction({ customRoleId: 'role-001', name: 'New Name' });
    const auditValues = auditInsert.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('UPDATE_CUSTOM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.detailsJson.before.name).toBe('Old Name');
    expect(auditValues.detailsJson.after.name).toBe('New Name');
  });
});

// ─── MFA re-verification ─────────────────────────────────────────────────────

describe('MFA re-verification for custom role mutations', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('createCustomRoleAction returns MFA error when step-up fails', async () => {
    mockSuperAdmin();
    mockRequireMfa.mockResolvedValueOnce({ error: 'MFA re-verification required', requiresMfa: true });
    const { createCustomRoleAction } = await import('../admin-custom-roles');
    const result = await createCustomRoleAction({ name: 'Valid Name', permissions: [] });
    expect(result).toEqual({ error: 'MFA re-verification required', requiresMfa: true });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('updateCustomRoleAction returns MFA error when step-up fails', async () => {
    mockSuperAdmin();
    mockRequireMfa.mockResolvedValueOnce({ error: 'MFA re-verification required', requiresMfa: true });
    const { updateCustomRoleAction } = await import('../admin-custom-roles');
    const result = await updateCustomRoleAction({ customRoleId: 'role-001', name: 'New Name' });
    expect(result).toEqual({ error: 'MFA re-verification required', requiresMfa: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
