import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  enforcementAction: {
    id: 'id', userId: 'user_id', actionType: 'action_type', status: 'status',
    contentReportId: 'content_report_id',
    appealReviewedByStaffId: 'appeal_reviewed_by_staff_id',
    appealReviewNote: 'appeal_review_note', appealResolvedAt: 'appeal_resolved_at',
    liftedAt: 'lifted_at', liftedByStaffId: 'lifted_by_staff_id', liftedReason: 'lifted_reason',
    updatedAt: 'updated_at',
  },
  sellerProfile: {
    userId: 'user_id', status: 'status',
    enforcementLevel: 'enforcement_level', enforcementStartedAt: 'enforcement_started_at',
    updatedAt: 'updated_at',
  },
  listing: { id: 'id', enforcementState: 'enforcement_state', updatedAt: 'updated_at' },
  contentReport: { id: 'id', targetType: 'target_type', targetId: 'target_id' },
  auditEvent: {},
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { reviewEnforcementAppealAction } from '../enforcement-appeals';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const STAFF_ID = 'staff-001';
const ACTION_ID = 'action-001';

function makeStaffSession(allow = true) {
  return {
    session: { staffUserId: STAFF_ID, email: 'staff@twicely.com', displayName: 'Staff', isPlatformStaff: true, platformRoles: ['MODERATION'] },
    ability: { can: vi.fn().mockReturnValue(allow) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);

// ─── reviewEnforcementAppealAction ────────────────────────────────────────────

describe('reviewEnforcementAppealAction', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  function makeAppealedAction(overrides: Record<string, unknown> = {}) {
    return {
      id: ACTION_ID, userId: USER_ID, actionType: 'WARNING',
      status: 'APPEALED', contentReportId: null,
      ...overrides,
    };
  }

  it('approves appeal (sets status to APPEAL_APPROVED)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Appeal reviewed and found valid.',
    });

    expect(result.success).toBe(true);
    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('APPEAL_APPROVED');
    expect(setArgs?.liftedAt).toBeInstanceOf(Date);
  });

  it('denies appeal (sets status back to ACTIVE)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Appeal reviewed but original action upheld.',
    });

    expect(result.success).toBe(true);
    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('ACTIVE');
  });

  it('rejects review of non-APPEALED action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction({ status: 'ACTIVE' })]) as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Reviewing a non-appealed action.',
    });
    expect(result.error).toBe('Only appealed actions can be reviewed');
  });

  it('rejects review without reviewNote', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: '',
    });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects review by SUPPORT role (no update permission)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession(false) as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Support trying to review an appeal.',
    });
    expect(result.error).toBe('Forbidden');
  });

  it('on approval of SUSPENSION: restores sellerProfile.status to ACTIVE', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction({ actionType: 'SUSPENSION' })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Suspension was issued in error.',
    });

    const calls = vi.mocked(updateChain.set).mock.calls;
    const sellerProfileUpdate = calls.find((c) => (c[0] as Record<string, unknown>)?.status === 'ACTIVE');
    expect(sellerProfileUpdate).toBeTruthy();
  });

  it('on approval of RESTRICTION: restores sellerProfile.status to ACTIVE', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction({ actionType: 'RESTRICTION' })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Restriction was applied in error.',
    });

    const calls = vi.mocked(updateChain.set).mock.calls;
    const sellerProfileUpdate = calls.find((c) => (c[0] as Record<string, unknown>)?.status === 'ACTIVE');
    expect(sellerProfileUpdate).toBeTruthy();
  });

  it('on approval of WARNING: clears enforcementLevel and enforcementStartedAt', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction({ actionType: 'WARNING' })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Warning was issued in error.',
    });

    const calls = vi.mocked(updateChain.set).mock.calls;
    const profileClear = calls.find((c) => {
      const args = c[0] as Record<string, unknown>;
      return args?.enforcementLevel === null && args?.enforcementStartedAt === null;
    });
    expect(profileClear).toBeTruthy();
  });

  it('on approval of LISTING_REMOVAL: restores listing enforcementState to CLEAR', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([makeAppealedAction({ actionType: 'LISTING_REMOVAL', contentReportId: 'report-001' })]) as never)
      .mockReturnValueOnce(makeSelectChain([{ targetType: 'LISTING', targetId: 'listing-001' }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Listing removal was in error.',
    });

    const calls = vi.mocked(updateChain.set).mock.calls;
    const listingClear = calls.find((c) => (c[0] as Record<string, unknown>)?.enforcementState === 'CLEAR');
    expect(listingClear).toBeTruthy();
  });

  it('creates audit event with correct decision field', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Appeal denied after review.',
    });

    const insertArgs = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs?.action).toBe('ENFORCEMENT_APPEAL_REVIEWED');
    expect((insertArgs?.detailsJson as Record<string, unknown>)?.decision).toBe('DENIED');
  });

  it('revalidates enforcement paths', async () => {
    const { revalidatePath } = await import('next/cache');
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Appeal approved.',
    });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/mod/enforcement');
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/mod/enforcement/${ACTION_ID}`);
  });
});
