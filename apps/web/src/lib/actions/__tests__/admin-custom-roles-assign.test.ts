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
}));

vi.mock('@twicely/db/schema', () => ({
  customRole: {
    id: 'id', name: 'name', code: 'code', isActive: 'is_active',
    updatedByStaffId: 'updated_by_staff_id', updatedAt: 'updated_at',
  },
  staffUserCustomRole: {
    id: 'id', staffUserId: 'staff_user_id', customRoleId: 'custom_role_id',
    revokedAt: 'revoked_at', grantedByStaffId: 'granted_by_staff_id',
  },
  staffUser: { id: 'id', isActive: 'is_active' },
  auditEvent: { id: 'id', action: 'action' },
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

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(result) }),
    }),
  };
}

function makeSelectJoinChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function makeSelectNoLimitChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(result),
    }),
  };
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

// ─── deleteCustomRoleAction ───────────────────────────────────────────────────

describe('deleteCustomRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when not SUPER_ADMIN', async () => {
    mockAdminOnly();
    const { deleteCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await deleteCustomRoleAction({ customRoleId: 'role-001' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('soft-deletes role (sets isActive = false)', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      id: 'role-001', name: 'Test Role', code: 'TEST_ROLE',
    }]));
    mockDbSelect.mockReturnValueOnce(makeSelectNoLimitChain([]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);
    mockDbInsert.mockReturnValueOnce(makeInsertChain());
    const { deleteCustomRoleAction } = await import('../admin-custom-roles-assign');
    const result = await deleteCustomRoleAction({ customRoleId: 'role-001' });
    expect(result).toEqual({ success: true });
    const updateArgs = updateChain.set.mock.calls[0]![0];
    expect(updateArgs.isActive).toBe(false);
  });

  it('auto-revokes all active staff assignments', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      id: 'role-001', name: 'Test Role', code: 'TEST_ROLE',
    }]));
    mockDbSelect.mockReturnValueOnce(makeSelectNoLimitChain([
      { id: 'a1' }, { id: 'a2' }, { id: 'a3' },
    ]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValueOnce(makeInsertChain());
    const { deleteCustomRoleAction } = await import('../admin-custom-roles-assign');
    await deleteCustomRoleAction({ customRoleId: 'role-001' });
    // First update: revoke assignments; second update: soft-delete role
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('creates CRITICAL audit event with affected staff count', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      id: 'role-001', name: 'Test Role', code: 'TEST_ROLE',
    }]));
    mockDbSelect.mockReturnValueOnce(makeSelectNoLimitChain([{ id: 'a1' }, { id: 'a2' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    const auditInsert = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditInsert);
    const { deleteCustomRoleAction } = await import('../admin-custom-roles-assign');
    await deleteCustomRoleAction({ customRoleId: 'role-001' });
    const auditValues = auditInsert.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('DELETE_CUSTOM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.detailsJson.affectedStaffCount).toBe(2);
  });
});

// ─── assignCustomRoleAction ───────────────────────────────────────────────────

describe('assignCustomRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when not SUPER_ADMIN', async () => {
    mockAdminOnly();
    const { assignCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await assignCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error for non-existent custom role', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { assignCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await assignCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'missing' }))
      .toEqual({ error: 'Custom role not found' });
  });

  it('returns error for non-existent staff user', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'role-001', name: 'Role', isActive: true }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const { assignCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await assignCustomRoleAction({ staffUserId: 'missing', customRoleId: 'role-001' }))
      .toEqual({ error: 'Staff user not found' });
  });

  it('returns error for duplicate assignment', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'role-001', name: 'Role', isActive: true }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'staff-001', isActive: true }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'assign-001' }]));
    const { assignCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await assignCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' }))
      .toEqual({ error: 'Role already assigned' });
  });

  it('assigns role and creates CRITICAL audit event', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'role-001', name: 'Test Role', isActive: true }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ id: 'staff-001', isActive: true }]));
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));
    const assignInsert = makeInsertChain();
    const auditInsert = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(assignInsert);
    mockDbInsert.mockReturnValueOnce(auditInsert);
    const { assignCustomRoleAction } = await import('../admin-custom-roles-assign');
    const result = await assignCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' });
    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    const auditValues = auditInsert.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('ASSIGN_CUSTOM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.actorType).toBe('STAFF');
  });
});

// ─── revokeCustomRoleAction ───────────────────────────────────────────────────

describe('revokeCustomRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when not SUPER_ADMIN', async () => {
    mockAdminOnly();
    const { revokeCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await revokeCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error when assignment not found', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectJoinChain([]));
    const { revokeCustomRoleAction } = await import('../admin-custom-roles-assign');
    expect(await revokeCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' }))
      .toEqual({ error: 'Role not currently assigned' });
  });

  it('soft-revokes (sets revokedAt) and creates CRITICAL audit event', async () => {
    mockSuperAdmin();
    mockDbSelect.mockReturnValueOnce(makeSelectJoinChain([{
      id: 'assign-001', customRoleName: 'Test Role',
    }]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValueOnce(updateChain);
    const auditInsert = makeInsertChain();
    mockDbInsert.mockReturnValueOnce(auditInsert);
    const { revokeCustomRoleAction } = await import('../admin-custom-roles-assign');
    const result = await revokeCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' });
    expect(result).toEqual({ success: true });
    const updateArgs = updateChain.set.mock.calls[0]![0];
    expect(updateArgs.revokedAt).toBeInstanceOf(Date);
    const auditValues = auditInsert.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REVOKE_CUSTOM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
  });
});

// ─── MFA re-verification ─────────────────────────────────────────────────────

describe('MFA re-verification for custom role assignment mutations', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('deleteCustomRoleAction returns MFA error when step-up fails', async () => {
    mockSuperAdmin();
    mockRequireMfa.mockResolvedValueOnce({ error: 'MFA re-verification required', requiresMfa: true });
    const { deleteCustomRoleAction } = await import('../admin-custom-roles-assign');
    const result = await deleteCustomRoleAction({ customRoleId: 'role-001' });
    expect(result).toEqual({ error: 'MFA re-verification required', requiresMfa: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('assignCustomRoleAction returns MFA error when step-up fails', async () => {
    mockSuperAdmin();
    mockRequireMfa.mockResolvedValueOnce({ error: 'MFA re-verification required', requiresMfa: true });
    const { assignCustomRoleAction } = await import('../admin-custom-roles-assign');
    const result = await assignCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' });
    expect(result).toEqual({ error: 'MFA re-verification required', requiresMfa: true });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('revokeCustomRoleAction returns MFA error when step-up fails', async () => {
    mockSuperAdmin();
    mockRequireMfa.mockResolvedValueOnce({ error: 'MFA re-verification required', requiresMfa: true });
    const { revokeCustomRoleAction } = await import('../admin-custom-roles-assign');
    const result = await revokeCustomRoleAction({ staffUserId: 'staff-001', customRoleId: 'role-001' });
    expect(result).toEqual({ error: 'MFA re-verification required', requiresMfa: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
