import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', isBanned: 'is_banned' },
  sellerProfile: { id: 'id', userId: 'user_id', status: 'status' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function mockAllowed(action = 'update', subject = 'User') {
  const ability = {
    can: vi.fn((a: string, s: string) => a === action && s === subject),
  };
  const session = {
    staffUserId: 'staff-test-001',
    email: 'admin@twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['ADMIN'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
  return { ability, session };
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-test-001',
    email: 'admin@twicely.co',
    displayName: 'Admin',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── suspendUserAction ────────────────────────────────────────────────────────

describe('suspendUserAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when CASL denies update on User', async () => {
    mockForbidden();
    const { suspendUserAction } = await import('../admin-users');
    const result = await suspendUserAction({ userId: 'user-a', reason: 'spam' });
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockAllowed('update', 'User');
    const { suspendUserAction } = await import('../admin-users');
    const result = await suspendUserAction({ reason: 'spam' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty reason', async () => {
    mockAllowed('update', 'User');
    const { suspendUserAction } = await import('../admin-users');
    const result = await suspendUserAction({ userId: 'user-a', reason: '' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for reason over 500 chars', async () => {
    mockAllowed('update', 'User');
    const { suspendUserAction } = await import('../admin-users');
    const result = await suspendUserAction({ userId: 'user-a', reason: 'x'.repeat(501) });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockAllowed('update', 'User');
    const { suspendUserAction } = await import('../admin-users');
    const result = await suspendUserAction({ userId: 'user-a', reason: 'policy', extra: 'bad' });
    expect(result).toEqual({ error: 'Invalid input' });
  });

  it('suspends user and creates audit event on success', async () => {
    mockAllowed('update', 'User');
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { suspendUserAction } = await import('../admin-users');
    const result = await suspendUserAction({ userId: 'user-a', reason: 'Policy violation' });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);

    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.action).toBe('SUSPEND_USER');
    expect(insertValues.severity).toBe('HIGH');
    expect(insertValues.actorType).toBe('STAFF');
    expect(insertValues.actorId).toBe('staff-test-001');
    expect(insertValues.detailsJson).toEqual({ reason: 'Policy violation' });
  });
});

// ─── unsuspendUserAction ──────────────────────────────────────────────────────

describe('unsuspendUserAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { unsuspendUserAction } = await import('../admin-users');
    expect(await unsuspendUserAction({ userId: 'user-a' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockAllowed('update', 'User');
    const { unsuspendUserAction } = await import('../admin-users');
    expect(await unsuspendUserAction({})).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockAllowed('update', 'User');
    const { unsuspendUserAction } = await import('../admin-users');
    expect(await unsuspendUserAction({ userId: 'user-a', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('unsuspends user and creates UNSUSPEND_USER audit event', async () => {
    mockAllowed('update', 'User');
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { unsuspendUserAction } = await import('../admin-users');
    const result = await unsuspendUserAction({ userId: 'user-a' });

    expect(result).toEqual({ success: true });
    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.action).toBe('UNSUSPEND_USER');
    expect(insertValues.severity).toBe('HIGH');
    expect(insertValues.subjectId).toBe('user-a');
  });
});

// ─── restrictSellingAction ────────────────────────────────────────────────────

describe('restrictSellingAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on SellerProfile', async () => {
    mockForbidden();
    const { restrictSellingAction } = await import('../admin-users');
    expect(await restrictSellingAction({ userId: 'user-a', reason: 'fraud' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing reason', async () => {
    mockAllowed('update', 'SellerProfile');
    const { restrictSellingAction } = await import('../admin-users');
    expect(await restrictSellingAction({ userId: 'user-a' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for reason over 500 chars', async () => {
    mockAllowed('update', 'SellerProfile');
    const { restrictSellingAction } = await import('../admin-users');
    expect(await restrictSellingAction({ userId: 'user-a', reason: 'r'.repeat(501) }))
      .toEqual({ error: 'Invalid input' });
  });

  it('restricts selling and creates audit event', async () => {
    mockAllowed('update', 'SellerProfile');
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { restrictSellingAction } = await import('../admin-users');
    const result = await restrictSellingAction({ userId: 'user-a', reason: 'Repeated violations' });

    expect(result).toEqual({ success: true });
    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.action).toBe('RESTRICT_SELLING');
    expect(insertValues.subject).toBe('SellerProfile');
    expect(insertValues.subjectId).toBe('user-a');
    expect(insertValues.severity).toBe('HIGH');
    expect(insertValues.detailsJson).toEqual({ reason: 'Repeated violations' });
  });
});
