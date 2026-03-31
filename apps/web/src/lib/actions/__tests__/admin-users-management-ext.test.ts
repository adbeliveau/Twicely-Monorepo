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
}));

vi.mock('@twicely/auth', () => ({
  auth: {
    api: {
      requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    },
  },
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

// ─── overridePerformanceBandAction ────────────────────────────────────────────

describe('overridePerformanceBandAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { overridePerformanceBandAction } = await import('../admin-users-management');
    expect(await overridePerformanceBandAction({ userId: 'u1', newBand: 'ESTABLISHED', reason: 'ok' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockAllowed('update', 'SellerProfile');
    const { overridePerformanceBandAction } = await import('../admin-users-management');
    expect(await overridePerformanceBandAction({ newBand: 'ESTABLISHED', reason: 'ok' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for missing newBand', async () => {
    mockAllowed('update', 'SellerProfile');
    const { overridePerformanceBandAction } = await import('../admin-users-management');
    expect(await overridePerformanceBandAction({ userId: 'u1', reason: 'ok' })).toEqual({ error: 'Invalid input' });
  });

  it('rejects SUSPENDED as newBand', async () => {
    mockAllowed('update', 'SellerProfile');
    const { overridePerformanceBandAction } = await import('../admin-users-management');
    expect(await overridePerformanceBandAction({ userId: 'u1', newBand: 'SUSPENDED', reason: 'ok' })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields', async () => {
    mockAllowed('update', 'SellerProfile');
    const { overridePerformanceBandAction } = await import('../admin-users-management');
    expect(await overridePerformanceBandAction({ userId: 'u1', newBand: 'ESTABLISHED', reason: 'ok', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('overrides band and creates OVERRIDE_PERFORMANCE_BAND audit event', async () => {
    mockAllowed('update', 'SellerProfile');
    mockDbSelect.mockReturnValue(makeSelectChain([{ performanceBand: 'EMERGING' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { overridePerformanceBandAction } = await import('../admin-users-management');
    const result = await overridePerformanceBandAction({ userId: 'u1', newBand: 'TOP_RATED', reason: 'Exceptional service' });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('OVERRIDE_PERFORMANCE_BAND');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.detailsJson.newBand).toBe('TOP_RATED');
    expect(auditValues.detailsJson.previousBand).toBe('EMERGING');
    expect(auditValues.detailsJson.reason).toBe('Exceptional service');
  });

  it('defaults expiresInDays to 90 when not provided', async () => {
    mockAllowed('update', 'SellerProfile');
    mockDbSelect.mockReturnValue(makeSelectChain([{ performanceBand: 'ESTABLISHED' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { overridePerformanceBandAction } = await import('../admin-users-management');
    const result = await overridePerformanceBandAction({ userId: 'u1', newBand: 'ESTABLISHED', reason: 'ok' });

    expect(result).toEqual({ success: true });
    const updateFields = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateFields.bandOverrideExpiresAt).toBeDefined();
  });

  it('includes previousBand in audit details', async () => {
    mockAllowed('update', 'SellerProfile');
    mockDbSelect.mockReturnValue(makeSelectChain([{ performanceBand: 'POWER_SELLER' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { overridePerformanceBandAction } = await import('../admin-users-management');
    await overridePerformanceBandAction({ userId: 'u1', newBand: 'ESTABLISHED', reason: 'Downgrade' });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.detailsJson.previousBand).toBe('POWER_SELLER');
  });
});

// ─── addInternalNoteAction ────────────────────────────────────────────────────

describe('addInternalNoteAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { addInternalNoteAction } = await import('../admin-users-management');
    expect(await addInternalNoteAction({ userId: 'u1', content: 'note' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for empty content', async () => {
    mockAllowed('update', 'User');
    const { addInternalNoteAction } = await import('../admin-users-management');
    expect(await addInternalNoteAction({ userId: 'u1', content: '' })).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for content over 2000 chars', async () => {
    mockAllowed('update', 'User');
    const { addInternalNoteAction } = await import('../admin-users-management');
    expect(await addInternalNoteAction({ userId: 'u1', content: 'x'.repeat(2001) })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields', async () => {
    mockAllowed('update', 'User');
    const { addInternalNoteAction } = await import('../admin-users-management');
    expect(await addInternalNoteAction({ userId: 'u1', content: 'ok', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('creates ADMIN_NOTE audit event with content in detailsJson', async () => {
    mockAllowed('update', 'User');
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { addInternalNoteAction } = await import('../admin-users-management');
    const result = await addInternalNoteAction({ userId: 'u1', content: 'This seller needs review' });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('ADMIN_NOTE');
    expect(auditValues.severity).toBe('LOW');
    expect(auditValues.subject).toBe('User');
    expect(auditValues.subjectId).toBe('u1');
    expect(auditValues.detailsJson).toEqual({ content: 'This seller needs review' });
  });
});

// ─── resetPasswordAction ──────────────────────────────────────────────────────

describe('resetPasswordAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { resetPasswordAction } = await import('../admin-users-management');
    expect(await resetPasswordAction({ userId: 'u1' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing userId', async () => {
    mockAllowed('update', 'User');
    const { resetPasswordAction } = await import('../admin-users-management');
    expect(await resetPasswordAction({})).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra fields', async () => {
    mockAllowed('update', 'User');
    const { resetPasswordAction } = await import('../admin-users-management');
    expect(await resetPasswordAction({ userId: 'u1', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('creates ADMIN_RESET_PASSWORD audit event', async () => {
    mockAllowed('update', 'User');
    mockDbSelect.mockReturnValue(makeSelectChain([{ email: 'jane@example.com' }]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { resetPasswordAction } = await import('../admin-users-management');
    const result = await resetPasswordAction({ userId: 'u1' });

    expect(result).toEqual({ success: true });
    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('ADMIN_RESET_PASSWORD');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.detailsJson.targetEmail).toBeDefined();
  });
});
