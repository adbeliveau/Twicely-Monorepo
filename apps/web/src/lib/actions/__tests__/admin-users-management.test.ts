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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@paralleldrive/cuid2', () => ({ createId: vi.fn().mockReturnValue('new-cuid-001') }));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', email: 'email', username: 'username', isBanned: 'is_banned', isSeller: 'is_seller' },
  sellerProfile: { id: 'id', userId: 'user_id', payoutsEnabled: 'payouts_enabled', performanceBand: 'performance_band', bandOverride: 'band_override', bandOverrideReason: 'band_override_reason', bandOverrideBy: 'band_override_by', bandOverrideExpiresAt: 'band_override_expires_at' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  sql: vi.fn(),
}));

vi.mock('@twicely/auth', () => ({
  auth: { api: {} },
}));

vi.mock('../staff-mfa', () => ({
  requireMfaForCriticalAction: vi.fn().mockResolvedValue(null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}
function makeInsertChain() { return { values: vi.fn().mockResolvedValue(undefined) }; }
function makeSelectChain(result: unknown[]) {
  const c: Record<string, unknown> = {};
  c['from'] = vi.fn().mockReturnValue(c);
  c['where'] = vi.fn().mockReturnValue(c);
  c['limit'] = vi.fn().mockResolvedValue(result);
  return c;
}

function mockAllowed(action: string, subject: string) {
  const ability = { can: vi.fn((a: string, s: string) => a === action && s === subject) };
  const session = { staffUserId: 'staff-001', email: 'admin@twicely.co', displayName: 'Admin', isPlatformStaff: true as const, platformRoles: ['ADMIN'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-001', email: 'support@twicely.co', displayName: 'Support', isPlatformStaff: true as const, platformRoles: ['SUPPORT'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── createUserAction ─────────────────────────────────────────────────────────

describe('createUserAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies create on User', async () => {
    mockForbidden();
    const { createUserAction } = await import('../admin-users-management');
    expect(await createUserAction({ name: 'Test', email: 'x@x.com' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing name', async () => {
    mockAllowed('create', 'User');
    const { createUserAction } = await import('../admin-users-management');
    expect(await createUserAction({ email: 'x@x.com' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for invalid email format', async () => {
    mockAllowed('create', 'User');
    const { createUserAction } = await import('../admin-users-management');
    expect(await createUserAction({ name: 'Test', email: 'not-an-email' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for name over 100 chars', async () => {
    mockAllowed('create', 'User');
    const { createUserAction } = await import('../admin-users-management');
    expect(await createUserAction({ name: 'x'.repeat(101), email: 'a@b.com' })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockAllowed('create', 'User');
    const { createUserAction } = await import('../admin-users-management');
    expect(await createUserAction({ name: 'Test', email: 'a@b.com', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('creates user and audit event on success', async () => {
    mockAllowed('create', 'User');
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    mockDbInsert.mockReturnValueOnce(makeInsertChain()).mockReturnValueOnce(makeInsertChain());

    const { createUserAction } = await import('../admin-users-management');
    const result = await createUserAction({ name: 'Jane Doe', email: 'jane@example.com' });

    expect(result).toEqual({ success: true, userId: 'new-cuid-001' });
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
    const auditValues = mockDbInsert.mock.results[1]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('CREATE_USER');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.actorType).toBe('STAFF');
  });

  it('returns error when email already exists', async () => {
    mockAllowed('create', 'User');
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: 'existing-id' }]));
    const { createUserAction } = await import('../admin-users-management');
    expect(await createUserAction({ name: 'Jane', email: 'jane@example.com' })).toEqual({ error: 'Email already in use' });
  });
});

// ─── holdPayoutsAction ────────────────────────────────────────────────────────

describe('holdPayoutsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on SellerProfile', async () => {
    mockForbidden();
    const { holdPayoutsAction } = await import('../admin-users-management');
    expect(await holdPayoutsAction({ userId: 'u1', reason: 'fraud' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockAllowed('update', 'SellerProfile');
    const { holdPayoutsAction } = await import('../admin-users-management');
    expect(await holdPayoutsAction({ reason: 'fraud' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for missing reason', async () => {
    mockAllowed('update', 'SellerProfile');
    const { holdPayoutsAction } = await import('../admin-users-management');
    expect(await holdPayoutsAction({ userId: 'u1' })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields via strict schema', async () => {
    mockAllowed('update', 'SellerProfile');
    const { holdPayoutsAction } = await import('../admin-users-management');
    expect(await holdPayoutsAction({ userId: 'u1', reason: 'test', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('sets payoutsEnabled to false and creates HOLD_PAYOUTS audit event', async () => {
    mockAllowed('update', 'SellerProfile');
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { holdPayoutsAction } = await import('../admin-users-management');
    const result = await holdPayoutsAction({ userId: 'u1', reason: 'fraud investigation' });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('HOLD_PAYOUTS');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.detailsJson).toEqual({ reason: 'fraud investigation' });
  });
});

// ─── releasePayoutsAction ─────────────────────────────────────────────────────

describe('releasePayoutsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { releasePayoutsAction } = await import('../admin-users-management');
    expect(await releasePayoutsAction({ userId: 'u1' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockAllowed('update', 'SellerProfile');
    const { releasePayoutsAction } = await import('../admin-users-management');
    expect(await releasePayoutsAction({})).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields', async () => {
    mockAllowed('update', 'SellerProfile');
    const { releasePayoutsAction } = await import('../admin-users-management');
    expect(await releasePayoutsAction({ userId: 'u1', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('sets payoutsEnabled to true and creates RELEASE_PAYOUTS audit event', async () => {
    mockAllowed('update', 'SellerProfile');
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { releasePayoutsAction } = await import('../admin-users-management');
    const result = await releasePayoutsAction({ userId: 'u1' });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('RELEASE_PAYOUTS');
    expect(auditValues.severity).toBe('HIGH');
  });
});
