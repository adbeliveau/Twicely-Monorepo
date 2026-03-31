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
  inArray: vi.fn((col, vals) => ({ col, vals })),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', enforcementState: 'enforcement_state' },
  review: { id: 'id', status: 'status', removedByStaffId: 'removed_by_staff_id', removedReason: 'removed_reason' },
  contentReport: { id: 'id', status: 'status', reviewedAt: 'reviewed_at', reviewedByStaffId: 'reviewed_by_staff_id' },
  auditEvent: { id: 'id', action: 'action' },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

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

function mockCanUpdateReport() {
  const ability = { can: vi.fn((a: string, s: string) => a === 'update' && s === 'ContentReport') };
  const session = { staffUserId: 'staff-mod-001', email: 'mod@twicely.co', displayName: 'Mod', isPlatformStaff: true as const, platformRoles: ['MODERATOR'] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

function mockForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  const session = { staffUserId: 'staff-001', email: 'a@b.co', displayName: 'A', isPlatformStaff: true as const, platformRoles: [] };
  mockStaffAuthorize.mockResolvedValue({ ability, session });
}

// ─── suppressListingAction ────────────────────────────────────────────────────

describe('suppressListingAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { suppressListingAction } = await import('../admin-moderation');
    expect(await suppressListingAction({ listingId: 'lst-1', reason: 'counterfeit' })).toEqual({ error: 'Forbidden' });
  });

  it('validates input with Zod strict (rejects unknown keys)', async () => {
    mockCanUpdateListing();
    const { suppressListingAction } = await import('../admin-moderation');
    expect(await suppressListingAction({ listingId: 'lst-1', reason: 'ok', extra: 'bad' })).toEqual({ error: 'Invalid input' });
  });

  it('sets enforcementState to SUPPRESSED and creates HIGH audit event', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { suppressListingAction } = await import('../admin-moderation');
    const result = await suppressListingAction({ listingId: 'lst-1', reason: 'Counterfeit' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.enforcementState).toBe('SUPPRESSED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('SUPPRESS_LISTING');
    expect(auditValues.severity).toBe('HIGH');
    expect(auditValues.actorId).toBe('staff-mod-001');
  });
});

// ─── reinstateListingAction ───────────────────────────────────────────────────

describe('reinstateListingAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { reinstateListingAction } = await import('../admin-moderation');
    expect(await reinstateListingAction({ listingId: 'lst-1', reason: 'ok' })).toEqual({ error: 'Forbidden' });
  });

  it('validates input', async () => {
    mockCanUpdateListing();
    const { reinstateListingAction } = await import('../admin-moderation');
    expect(await reinstateListingAction({})).toEqual({ error: 'Invalid input' });
  });

  it('reinstates listing to CLEAR and creates MEDIUM audit event', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { reinstateListingAction } = await import('../admin-moderation');
    const result = await reinstateListingAction({ listingId: 'lst-2', reason: 'False positive' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.enforcementState).toBe('CLEAR');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('REINSTATE_LISTING');
    expect(auditValues.severity).toBe('MEDIUM');
  });
});

// ─── flagListingAction ────────────────────────────────────────────────────────

describe('flagListingAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('flags a CLEAR listing and creates MEDIUM audit event', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { flagListingAction } = await import('../admin-moderation');
    const result = await flagListingAction({ listingId: 'lst-3', reason: 'Suspicious' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.enforcementState).toBe('FLAGGED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('FLAG_LISTING');
    expect(auditValues.severity).toBe('MEDIUM');
  });
});

// ─── bulkDismissReportsAction ─────────────────────────────────────────────────

describe('bulkDismissReportsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns error on empty array', async () => {
    mockCanUpdateReport();
    const { bulkDismissReportsAction } = await import('../admin-moderation-helpers');
    // Zod min(1) catches empty array before we even reach the length check
    expect(await bulkDismissReportsAction({ reportIds: [] })).toEqual({ error: 'Invalid input' });
  });

  it('dismisses all reports and creates audit event', async () => {
    mockCanUpdateReport();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { bulkDismissReportsAction } = await import('../admin-moderation-helpers');
    const result = await bulkDismissReportsAction({ reportIds: ['r1', 'r2'] });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('DISMISSED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('BULK_DISMISS_REPORTS');
    expect(auditValues.severity).toBe('HIGH');
  });

  it('rejects unknown keys via strict schema', async () => {
    mockCanUpdateReport();
    const { bulkDismissReportsAction } = await import('../admin-moderation-helpers');
    expect(await bulkDismissReportsAction({ reportIds: ['r1'], bad: 'key' })).toEqual({ error: 'Invalid input' });
  });
});

// ─── bulkClearListingFlagsAction ──────────────────────────────────────────────

describe('bulkClearListingFlagsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('clears flags on multiple listings', async () => {
    mockCanUpdateListing();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { bulkClearListingFlagsAction } = await import('../admin-moderation');
    const result = await bulkClearListingFlagsAction({ listingIds: ['lst-a', 'lst-b'] });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.enforcementState).toBe('CLEAR');
  });
});

// ─── flagReviewAction ─────────────────────────────────────────────────────────

describe('flagReviewAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { flagReviewAction } = await import('../admin-moderation-helpers');
    expect(await flagReviewAction({ reviewId: 'rev-1' })).toEqual({ error: 'Forbidden' });
  });

  it('flags an APPROVED review and creates MEDIUM audit event', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { flagReviewAction } = await import('../admin-moderation-helpers');
    const result = await flagReviewAction({ reviewId: 'rev-1' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('FLAGGED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('FLAG_REVIEW');
    expect(auditValues.severity).toBe('MEDIUM');
  });
});

// ─── bulkApproveReviewsAction ─────────────────────────────────────────────────

describe('bulkApproveReviewsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('approves multiple reviews and creates audit events', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { bulkApproveReviewsAction } = await import('../admin-moderation-helpers');
    const result = await bulkApproveReviewsAction({ reviewIds: ['rev-a', 'rev-b'] });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('APPROVED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('BULK_APPROVE_REVIEWS');
  });
});

// ─── bulkRemoveReviewsAction ──────────────────────────────────────────────────

describe('bulkRemoveReviewsAction', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('removes multiple reviews and creates audit events', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { bulkRemoveReviewsAction } = await import('../admin-moderation-helpers');
    const result = await bulkRemoveReviewsAction({ reviewIds: ['rev-a', 'rev-b'] });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('REMOVED');

    const auditValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(auditValues.action).toBe('BULK_REMOVE_REVIEWS');
    expect(auditValues.severity).toBe('HIGH');
  });
});

// ─── removeReviewAction (enhanced) ───────────────────────────────────────────

describe('removeReviewAction (enhanced)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('stores removedReason and removedByStaffId when reason provided', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeReviewAction } = await import('../admin-moderation-helpers');
    const result = await removeReviewAction({ reviewId: 'rev-1', reason: 'Fake review' });

    expect(result).toEqual({ success: true });
    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.status).toBe('REMOVED');
    expect(updateSet.removedByStaffId).toBe('staff-mod-001');
    expect(updateSet.removedReason).toBe('Fake review');
  });

  it('sets removedReason to null when no reason provided', async () => {
    mockCanUpdateReview();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { removeReviewAction } = await import('../admin-moderation-helpers');
    await removeReviewAction({ reviewId: 'rev-1' });

    const updateSet = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(updateSet.removedReason).toBeNull();
  });

  it('returns Forbidden when CASL denies', async () => {
    mockForbidden();
    const { removeReviewAction } = await import('../admin-moderation-helpers');
    expect(await removeReviewAction({ reviewId: 'rev-1' })).toEqual({ error: 'Forbidden' });
  });
});
