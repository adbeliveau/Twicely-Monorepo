import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { insert: mockDbInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', isBanned: 'is_banned' },
  sellerProfile: { id: 'id', userId: 'user_id', status: 'status' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function mockCanUpdateUser() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'User') };
  const session = {
    staffUserId: 'staff-001',
    email: 'support@twicely.co',
    displayName: 'Support',
    isPlatformStaff: true as const,
    platformRoles: ['SUPPORT'],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = {
    staffUserId: 'staff-readonly-001',
    email: 'readonly@twicely.co',
    displayName: 'ReadOnly',
    isPlatformStaff: true as const,
    platformRoles: [],
  };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── warnUserAction ───────────────────────────────────────────────────────────

describe('warnUserAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on User', async () => {
    mockForbidden();
    const { warnUserAction } = await import('../admin-users');
    expect(await warnUserAction({ userId: 'user-a', message: 'warning' }))
      .toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockCanUpdateUser();
    const { warnUserAction } = await import('../admin-users');
    expect(await warnUserAction({ message: 'warning' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty message', async () => {
    mockCanUpdateUser();
    const { warnUserAction } = await import('../admin-users');
    expect(await warnUserAction({ userId: 'user-a', message: '' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for message over 1000 chars', async () => {
    mockCanUpdateUser();
    const { warnUserAction } = await import('../admin-users');
    expect(await warnUserAction({ userId: 'user-a', message: 'm'.repeat(1001) }))
      .toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanUpdateUser();
    const { warnUserAction } = await import('../admin-users');
    expect(await warnUserAction({ userId: 'user-a', message: 'ok', extra: 'bad' }))
      .toEqual({ error: 'Invalid input' });
  });

  it('creates WARN_USER audit event at MEDIUM severity', async () => {
    mockCanUpdateUser();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { warnUserAction } = await import('../admin-users');
    const result = await warnUserAction({ userId: 'user-a', message: 'Please review our policies.' });

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const insertValues = auditChain.values.mock.calls[0]![0];
    expect(insertValues.action).toBe('WARN_USER');
    expect(insertValues.severity).toBe('MEDIUM');
    expect(insertValues.subject).toBe('User');
    expect(insertValues.subjectId).toBe('user-a');
    expect(insertValues.detailsJson).toEqual({ message: 'Please review our policies.' });
  });

  it('stores actorId from session in audit event', async () => {
    mockCanUpdateUser();
    const auditChain = makeInsertChain();
    mockDbInsert.mockReturnValue(auditChain);

    const { warnUserAction } = await import('../admin-users');
    await warnUserAction({ userId: 'user-b', message: 'Warning issued.' });

    const insertValues = auditChain.values.mock.calls[0]![0];
    expect(insertValues.actorId).toBe('staff-001');
    expect(insertValues.actorType).toBe('STAFF');
  });

  it('does not call db.update (warn is audit-only, no state change)', async () => {
    mockCanUpdateUser();
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { warnUserAction } = await import('../admin-users');
    await warnUserAction({ userId: 'user-c', message: 'Be careful.' });

    // warnUserAction only inserts the audit event — no update
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('accepts message at exactly 1000 chars (boundary)', async () => {
    mockCanUpdateUser();
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { warnUserAction } = await import('../admin-users');
    const result = await warnUserAction({ userId: 'user-d', message: 'w'.repeat(1000) });

    expect(result).toEqual({ success: true });
  });
});
