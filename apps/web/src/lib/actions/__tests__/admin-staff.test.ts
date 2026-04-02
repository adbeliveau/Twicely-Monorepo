import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
const mockDbDelete = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { update: mockDbUpdate, insert: mockDbInsert, select: mockDbSelect, delete: mockDbDelete },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((col) => ({ isNull: col })),
}));

vi.mock('@twicely/db/schema', () => ({
  staffUser: { id: 'id', email: 'email', displayName: 'display_name', passwordHash: 'password_hash' },
  staffUserRole: { id: 'id', staffUserId: 'staff_user_id', role: 'role', revokedAt: 'revoked_at' },
  staffSession: { id: 'id', staffUserId: 'staff_user_id' },
  auditEvent: { id: 'id', action: 'action' },
  customRole: { id: 'id', name: 'name' },
  staffUserCustomRole: { id: 'id' },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({ hash: vi.fn().mockResolvedValue('hashed-password') }));
vi.mock('@paralleldrive/cuid2', () => ({ createId: vi.fn().mockReturnValue('new-staff-id-001') }));

vi.mock('../staff-mfa', () => ({
  requireMfaForCriticalAction: vi.fn().mockResolvedValue(null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeSelectChain(rows: unknown[] = []) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(rows) };
}

function mockAllowed(action = 'manage', subject = 'StaffUser', isSuperAdmin = false) {
  const ability = { can: vi.fn((a: string, s: string) => a === action && s === subject) };
  const session = {
    staffUserId: 'acting-staff-001',
    email: 'admin@hub.twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: isSuperAdmin ? ['SUPER_ADMIN'] : ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'acting-staff-001',
    email: 'support@hub.twicely.co',
    displayName: 'Support',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── createStaffUserAction ────────────────────────────────────────────────────

describe('createStaffUserAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies manage on StaffUser', async () => {
    mockForbidden();
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'x@x.com', displayName: 'X', password: 'password123', roles: ['SUPPORT'] }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing email', async () => {
    mockAllowed('manage', 'StaffUser');
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ displayName: 'X', password: 'password123', roles: ['SUPPORT'] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for invalid email format', async () => {
    mockAllowed('manage', 'StaffUser');
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'not-an-email', displayName: 'X', password: 'password123', roles: ['SUPPORT'] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for password under 10 chars', async () => {
    mockAllowed('manage', 'StaffUser');
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'x@x.com', displayName: 'X', password: 'short', roles: ['SUPPORT'] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty roles array', async () => {
    mockAllowed('manage', 'StaffUser');
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'x@x.com', displayName: 'X', password: 'password123', roles: [] }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via .strict()', async () => {
    mockAllowed('manage', 'StaffUser');
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'x@x.com', displayName: 'X', password: 'password123', roles: ['SUPPORT'], extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns Email already in use for duplicate email', async () => {
    mockAllowed('manage', 'StaffUser');
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'existing-id' }]));
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'exists@x.com', displayName: 'X', password: 'password123', roles: ['SUPPORT'] }))
      .toEqual({ error: 'Email already in use' });
  });

  it('ADMIN cannot grant ADMIN role', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'x@x.com', displayName: 'X', password: 'password123', roles: ['ADMIN'] }))
      .toEqual({ error: 'Only SUPER_ADMIN can grant ADMIN roles' });
  });

  it('ADMIN cannot grant SUPER_ADMIN role', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'x@x.com', displayName: 'X', password: 'password123', roles: ['SUPER_ADMIN'] }))
      .toEqual({ error: 'Only SUPER_ADMIN can grant ADMIN roles' });
  });

  it('SUPER_ADMIN can grant ADMIN role', async () => {
    mockAllowed('manage', 'StaffUser', true);
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { createStaffUserAction } = await import('../admin-staff');
    expect(await createStaffUserAction({ email: 'admin2@x.com', displayName: 'Admin2', password: 'password123', roles: ['ADMIN'] }))
      .toEqual({ success: true, staffUserId: 'new-staff-id-001' });
  });

  it('creates staff user + roles + audit event on success', async () => {
    mockAllowed('manage', 'StaffUser', false);
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { createStaffUserAction } = await import('../admin-staff');
    const result = await createStaffUserAction({ email: 'new@x.com', displayName: 'New', password: 'password123', roles: ['SUPPORT'] });
    expect(result).toEqual({ success: true, staffUserId: 'new-staff-id-001' });
    // staffUser + staffUserRole (1 role) + auditEvent = 3 inserts
    expect(mockDbInsert).toHaveBeenCalledTimes(3);
  });

  it('password is hashed — not stored in plain text', async () => {
    const { hash } = await import('bcryptjs');
    mockAllowed('manage', 'StaffUser', false);
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { createStaffUserAction } = await import('../admin-staff');
    await createStaffUserAction({ email: 'new@x.com', displayName: 'New', password: 'password123', roles: ['SUPPORT'] });
    expect(hash).toHaveBeenCalledWith('password123', 10);
  });
});

// ─── grantSystemRoleAction ────────────────────────────────────────────────────

describe('grantSystemRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing staffUserId', async () => {
    mockAllowed('manage', 'StaffUser');
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ role: 'SUPPORT' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for invalid role value', async () => {
    mockAllowed('manage', 'StaffUser');
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'target-001', role: 'INVALID_ROLE' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields', async () => {
    mockAllowed('manage', 'StaffUser');
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT', extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('returns error when ADMIN tries to grant ADMIN role', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'target-001', role: 'ADMIN' }))
      .toEqual({ error: 'Only SUPER_ADMIN can grant this role' });
  });

  it('returns error when ADMIN tries to grant SUPER_ADMIN role', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'target-001', role: 'SUPER_ADMIN' }))
      .toEqual({ error: 'Only SUPER_ADMIN can grant this role' });
  });

  it('returns error when trying to modify own roles', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'acting-staff-001', role: 'SUPPORT' }))
      .toEqual({ error: 'Cannot modify own roles' });
  });

  it('returns error when role already assigned', async () => {
    mockAllowed('manage', 'StaffUser', false);
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'existing-role-row' }]));
    const { grantSystemRoleAction } = await import('../admin-staff');
    expect(await grantSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT' }))
      .toEqual({ error: 'Role already assigned' });
  });

  it('grants role and creates CRITICAL audit event on success', async () => {
    mockAllowed('manage', 'StaffUser', false);
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { grantSystemRoleAction } = await import('../admin-staff');
    const result = await grantSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT' });
    expect(result).toEqual({ success: true });
    // insert called twice: staffUserRole (calls[0]) then auditEvent (calls[1])
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[1]![0];
    expect(auditValues.action).toBe('GRANT_SYSTEM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
    expect(auditValues.actorType).toBe('STAFF');
  });
});

// ─── revokeSystemRoleAction ───────────────────────────────────────────────────

describe('revokeSystemRoleAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { revokeSystemRoleAction } = await import('../admin-staff');
    expect(await revokeSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error when ADMIN tries to revoke ADMIN role', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { revokeSystemRoleAction } = await import('../admin-staff');
    expect(await revokeSystemRoleAction({ staffUserId: 'target-001', role: 'ADMIN' }))
      .toEqual({ error: 'Only SUPER_ADMIN can revoke this role' });
  });

  it('returns error when trying to modify own roles', async () => {
    mockAllowed('manage', 'StaffUser', false);
    const { revokeSystemRoleAction } = await import('../admin-staff');
    expect(await revokeSystemRoleAction({ staffUserId: 'acting-staff-001', role: 'SUPPORT' }))
      .toEqual({ error: 'Cannot modify own roles' });
  });

  it('returns error when role not currently assigned', async () => {
    mockAllowed('manage', 'StaffUser', false);
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { revokeSystemRoleAction } = await import('../admin-staff');
    expect(await revokeSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT' }))
      .toEqual({ error: 'Role not currently assigned' });
  });

  it('soft-deletes role (sets revokedAt) and creates CRITICAL audit event', async () => {
    mockAllowed('manage', 'StaffUser', false);
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'role-row-id' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { revokeSystemRoleAction } = await import('../admin-staff');
    const result = await revokeSystemRoleAction({ staffUserId: 'target-001', role: 'SUPPORT' });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REVOKE_SYSTEM_ROLE');
    expect(auditValues.severity).toBe('CRITICAL');
  });
});
