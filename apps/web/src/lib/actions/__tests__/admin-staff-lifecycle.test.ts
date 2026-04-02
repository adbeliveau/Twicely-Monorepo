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

vi.mock('../staff-mfa', () => ({
  requireMfaForCriticalAction: vi.fn().mockResolvedValue(null),
}));

vi.mock('@twicely/db/schema', () => ({
  staffUser: { id: 'id', isActive: 'is_active', passwordHash: 'password_hash' },
  staffUserRole: { id: 'id', staffUserId: 'staff_user_id', role: 'role', revokedAt: 'revoked_at' },
  staffSession: { id: 'id', staffUserId: 'staff_user_id' },
  auditEvent: { id: 'id', action: 'action' },
  customRole: { id: 'id' },
  staffUserCustomRole: { id: 'id' },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({ hash: vi.fn().mockResolvedValue('hashed-new-password') }));
vi.mock('@paralleldrive/cuid2', () => ({ createId: vi.fn().mockReturnValue('new-id-001') }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) };
}

function mockAllowed(isSuperAdmin = false) {
  const ability = { can: vi.fn().mockReturnValue(true) };
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
  mockStaffAuthorize.mockResolvedValue({
    ability,
    session: { staffUserId: 'x', email: 'x@x.com', displayName: 'X', isPlatformStaff: true, platformRoles: ['SUPPORT'] },
  });
}

// ─── deactivateStaffAction ────────────────────────────────────────────────────

describe('deactivateStaffAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { deactivateStaffAction } = await import('../admin-staff-lifecycle');
    expect(await deactivateStaffAction({ staffUserId: 'target-001', reason: 'test' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error when trying to deactivate self', async () => {
    const ability = { can: vi.fn().mockReturnValue(true) };
    mockStaffAuthorize.mockResolvedValue({
      ability,
      session: { staffUserId: 'self-id', email: 'x@x.com', displayName: 'X', isPlatformStaff: true, platformRoles: ['ADMIN'] },
    });
    const { deactivateStaffAction } = await import('../admin-staff-lifecycle');
    expect(await deactivateStaffAction({ staffUserId: 'self-id', reason: 'test' }))
      .toEqual({ error: 'Cannot deactivate own account' });
  });

  it('returns error when ADMIN tries to deactivate SUPER_ADMIN', async () => {
    const ability = { can: vi.fn().mockReturnValue(true) };
    mockStaffAuthorize.mockResolvedValue({
      ability,
      session: { staffUserId: 'acting-001', email: 'x@x.com', displayName: 'X', isPlatformStaff: true, platformRoles: ['ADMIN'] },
    });
    // query returns SUPER_ADMIN role for target
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([{ role: 'SUPER_ADMIN' }]);
    mockDbSelect.mockReturnValue({ from: mockFrom, where: mockWhere });
    const { deactivateStaffAction } = await import('../admin-staff-lifecycle');
    expect(await deactivateStaffAction({ staffUserId: 'super-admin-target', reason: 'test' }))
      .toEqual({ error: 'Cannot deactivate SUPER_ADMIN' });
  });

  it('deactivates staff, deletes sessions, and creates HIGH audit event', async () => {
    mockAllowed(true); // SUPER_ADMIN skips hierarchy check
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { deactivateStaffAction } = await import('../admin-staff-lifecycle');
    const result = await deactivateStaffAction({ staffUserId: 'target-001', reason: 'Policy violation' });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('DEACTIVATE_STAFF');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.detailsJson).toEqual({ reason: 'Policy violation' });
  });
});

// ─── reactivateStaffAction ────────────────────────────────────────────────────

describe('reactivateStaffAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { reactivateStaffAction } = await import('../admin-staff-lifecycle');
    expect(await reactivateStaffAction({ staffUserId: 'target-001' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error when ADMIN tries to reactivate SUPER_ADMIN', async () => {
    const ability = { can: vi.fn().mockReturnValue(true) };
    mockStaffAuthorize.mockResolvedValue({
      ability,
      session: { staffUserId: 'acting-001', email: 'x@x.com', displayName: 'X', isPlatformStaff: true, platformRoles: ['ADMIN'] },
    });
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([{ role: 'SUPER_ADMIN' }]);
    mockDbSelect.mockReturnValue({ from: mockFrom, where: mockWhere });
    const { reactivateStaffAction } = await import('../admin-staff-lifecycle');
    expect(await reactivateStaffAction({ staffUserId: 'super-admin-target' }))
      .toEqual({ error: 'Cannot reactivate SUPER_ADMIN' });
  });

  it('reactivates staff and creates HIGH audit event', async () => {
    mockAllowed(true); // SUPER_ADMIN skips hierarchy check
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { reactivateStaffAction } = await import('../admin-staff-lifecycle');
    const result = await reactivateStaffAction({ staffUserId: 'target-001' });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REACTIVATE_STAFF');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.actorType).toBe('STAFF');
  });
});

// ─── resetStaffPasswordAction ─────────────────────────────────────────────────

describe('resetStaffPasswordAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { resetStaffPasswordAction } = await import('../admin-staff-lifecycle');
    expect(await resetStaffPasswordAction({ staffUserId: 'target-001', newPassword: 'newpass1234' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns error when ADMIN tries to reset SUPER_ADMIN password', async () => {
    const ability = { can: vi.fn().mockReturnValue(true) };
    mockStaffAuthorize.mockResolvedValue({
      ability,
      session: { staffUserId: 'acting-001', email: 'x@x.com', displayName: 'X', isPlatformStaff: true, platformRoles: ['ADMIN'] },
    });
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([{ role: 'SUPER_ADMIN' }]);
    mockDbSelect.mockReturnValue({ from: mockFrom, where: mockWhere });
    const { resetStaffPasswordAction } = await import('../admin-staff-lifecycle');
    expect(await resetStaffPasswordAction({ staffUserId: 'super-admin-target', newPassword: 'newpass1234' }))
      .toEqual({ error: 'Cannot reset SUPER_ADMIN password' });
  });

  it('resets password, kills sessions, creates HIGH audit event', async () => {
    mockAllowed(true); // SUPER_ADMIN skips hierarchy check
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbDelete.mockReturnValue(makeDeleteChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { resetStaffPasswordAction } = await import('../admin-staff-lifecycle');
    const result = await resetStaffPasswordAction({ staffUserId: 'target-001', newPassword: 'newpassword123' });
    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('RESET_STAFF_PASSWORD');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.actorType).toBe('STAFF');
    expect(auditValues.actorId).toBe('acting-staff-001');
  });

  it('rejects extra fields via .strict()', async () => {
    mockAllowed(false);
    const { resetStaffPasswordAction } = await import('../admin-staff-lifecycle');
    expect(await resetStaffPasswordAction({ staffUserId: 'target-001', newPassword: 'newpass1234', extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });
});
