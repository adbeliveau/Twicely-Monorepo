import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

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
  listing: { id: 'id', enforcementState: 'enforcement_state' },
  review: { id: 'id', status: 'status' },
  auditEvent: { id: 'id', action: 'action' },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function mockCanUpdateListing() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'Listing') };
  const session = { staffUserId: 'staff-mod-001', email: 'mod@twicely.co', displayName: 'Mod', isPlatformStaff: true as const, platformRoles: ['MODERATOR'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockCanUpdateReview() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'Review') };
  const session = { staffUserId: 'staff-mod-001', email: 'mod@twicely.co', displayName: 'Mod', isPlatformStaff: true as const, platformRoles: ['MODERATOR'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── removeListingAction ──────────────────────────────────────────────────────

describe('removeListingAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on Listing', async () => {
    mockForbidden();
    const { removeListingAction } = await import('../admin-moderation');
    expect(await removeListingAction({ listingId: 'lst-1' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing listingId', async () => {
    mockCanUpdateListing();
    const { removeListingAction } = await import('../admin-moderation');
    expect(await removeListingAction({})).toEqual({ error: 'Invalid input' });
  });

  it('returns Invalid input for empty listingId', async () => {
    mockCanUpdateListing();
    const { removeListingAction } = await import('../admin-moderation');
    expect(await removeListingAction({ listingId: '' })).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields via strict schema', async () => {
    mockCanUpdateListing();
    const { removeListingAction } = await import('../admin-moderation');
    expect(await removeListingAction({ listingId: 'lst-1', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('sets enforcementState to REMOVED and creates HIGH audit event', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeListingAction } = await import('../admin-moderation');
    const result = await removeListingAction({ listingId: 'lst-1', reason: 'Counterfeit item' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.enforcementState).toBe('REMOVED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REMOVE_LISTING');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subject).toBe('Listing');
    expect(auditValues.subjectId).toBe('lst-1');
    expect(auditValues.actorType).toBe('STAFF');
  });

  it('defaults reason to empty string when not provided', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeListingAction } = await import('../admin-moderation');
    await removeListingAction({ listingId: 'lst-1' });

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.detailsJson).toEqual({ reason: '' });
  });
});

// ─── clearListingFlagAction ───────────────────────────────────────────────────

describe('clearListingFlagAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { clearListingFlagAction } = await import('../admin-moderation');
    expect(await clearListingFlagAction({ listingId: 'lst-1' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing listingId', async () => {
    mockCanUpdateListing();
    const { clearListingFlagAction } = await import('../admin-moderation');
    expect(await clearListingFlagAction({})).toEqual({ error: 'Invalid input' });
  });

  it('sets enforcementState to CLEAR and creates MEDIUM audit event', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { clearListingFlagAction } = await import('../admin-moderation');
    const result = await clearListingFlagAction({ listingId: 'lst-2' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.enforcementState).toBe('CLEAR');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('CLEAR_LISTING_FLAG');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subjectId).toBe('lst-2');
  });
});

// ─── removeReviewAction ───────────────────────────────────────────────────────

describe('removeReviewAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies update on Review', async () => {
    mockForbidden();
    const { removeReviewAction } = await import('../admin-moderation-helpers');
    expect(await removeReviewAction({ reviewId: 'rev-1' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing reviewId', async () => {
    mockCanUpdateReview();
    const { removeReviewAction } = await import('../admin-moderation-helpers');
    expect(await removeReviewAction({})).toEqual({ error: 'Invalid input' });
  });

  it('rejects extra (unknown) fields', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    const { removeReviewAction } = await import('../admin-moderation-helpers');
    // reason is now a valid field; truly unknown fields are still rejected
    expect(await removeReviewAction({ reviewId: 'rev-1', unknownField: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('sets review status to REMOVED and creates HIGH audit event', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeReviewAction } = await import('../admin-moderation-helpers');
    const result = await removeReviewAction({ reviewId: 'rev-1' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('REMOVED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REMOVE_REVIEW');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.subject).toBe('Review');
    expect(auditValues.subjectId).toBe('rev-1');
  });
});

// ─── approveReviewAction ──────────────────────────────────────────────────────

describe('approveReviewAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { approveReviewAction } = await import('../admin-moderation-helpers');
    expect(await approveReviewAction({ reviewId: 'rev-1' })).toEqual({ error: 'Forbidden' });
  });

  it('returns Invalid input for missing reviewId', async () => {
    mockCanUpdateReview();
    const { approveReviewAction } = await import('../admin-moderation-helpers');
    expect(await approveReviewAction({})).toEqual({ error: 'Invalid input' });
  });

  it('sets review status to APPROVED and creates MEDIUM audit event', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { approveReviewAction } = await import('../admin-moderation-helpers');
    const result = await approveReviewAction({ reviewId: 'rev-2' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('APPROVED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('APPROVE_REVIEW');
    expect(auditValues.severity).toBe('MEDIUM');
    expect(auditValues.subject).toBe('Review');
    expect(auditValues.subjectId).toBe('rev-2');
    expect(auditValues.actorId).toBe('staff-mod-001');
  });
});
