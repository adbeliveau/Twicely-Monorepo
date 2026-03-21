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

const USER_ID = 'user-approval-001';
const STAFF_ID = 'staff-approval-001';
const ACTION_ID = 'action-approval-001';

function makeStaffSession(allow = true) {
  return {
    session: {
      staffUserId: STAFF_ID, email: 'staff@twicely.com', displayName: 'Staff',
      isPlatformStaff: true, platformRoles: ['MODERATION'],
    },
    ability: { can: vi.fn().mockReturnValue(allow) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() { return { values: vi.fn().mockResolvedValue(undefined) }; }

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

const mockStaffAuthorize = vi.mocked(staffAuthorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);

function makeAppealedAction(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTION_ID, userId: USER_ID, actionType: 'WARNING',
    status: 'APPEALED', contentReportId: null, ...overrides,
  };
}

// ─── Approval: liftedReason and staff fields ───────────────────────────────────

describe('reviewEnforcementAppealAction — approval: liftedReason and staff fields', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('liftedReason starts with "Appeal approved:" and contains reviewNote', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const reviewNote = 'This warning was not justified by the evidence.';
    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote,
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect((setArgs?.liftedReason as string).startsWith('Appeal approved:')).toBe(true);
    expect(setArgs?.liftedReason).toContain(reviewNote);
  });

  it('liftedByStaffId is set to reviewing staff ID', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Appeal is valid.',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.liftedByStaffId).toBe(STAFF_ID);
    expect(setArgs?.appealReviewedByStaffId).toBe(STAFF_ID);
  });
});

// ─── Approval: PRE_SUSPENSION and LISTING_SUPPRESSION ─────────────────────────

describe('reviewEnforcementAppealAction — approval: PRE_SUSPENSION and LISTING_SUPPRESSION', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('on approval of PRE_SUSPENSION: clears enforcementLevel and enforcementStartedAt', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeAppealedAction({ actionType: 'PRE_SUSPENSION' })]) as never
    );
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Pre-suspension was applied in error.',
    });

    const calls = vi.mocked(updateChain.set).mock.calls;
    const profileClear = calls.find((c) => {
      const args = c[0] as Record<string, unknown>;
      return args?.enforcementLevel === null && args?.enforcementStartedAt === null;
    });
    expect(profileClear).toBeTruthy();
  });

  it('on approval of LISTING_SUPPRESSION: restores listing enforcementState to CLEAR', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect
      .mockReturnValueOnce(
        makeSelectChain([makeAppealedAction({
          actionType: 'LISTING_SUPPRESSION', contentReportId: 'report-sup-001',
        })]) as never
      )
      .mockReturnValueOnce(
        makeSelectChain([{ targetType: 'LISTING', targetId: 'listing-sup-001' }]) as never
      );
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Listing suppression was applied in error.',
    });

    const calls = vi.mocked(updateChain.set).mock.calls;
    const listingClear = calls.find(
      (c) => (c[0] as Record<string, unknown>)?.enforcementState === 'CLEAR'
    );
    expect(listingClear).toBeTruthy();
  });

  it('on approval of LISTING_REMOVAL with no contentReportId: does not attempt listing restore', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    // contentReportId is null — no linked report
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeAppealedAction({ actionType: 'LISTING_REMOVAL', contentReportId: null })]) as never
    );
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Listing removal with no linked report.',
    });

    expect(result.success).toBe(true);
    // enforcementState: CLEAR should NOT be in any update call
    const calls = vi.mocked(updateChain.set).mock.calls;
    const listingClear = calls.find(
      (c) => (c[0] as Record<string, unknown>)?.enforcementState === 'CLEAR'
    );
    expect(listingClear).toBeUndefined();
  });
});

// ─── Audit event field verification (review) ──────────────────────────────────

describe('reviewEnforcementAppealAction — audit event field verification', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('audit event: actorType=STAFF, actorId=staffId, severity=HIGH', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Appeal approved.',
    });

    const insertArgs = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs?.actorType).toBe('STAFF');
    expect(insertArgs?.actorId).toBe(STAFF_ID);
    expect(insertArgs?.severity).toBe('HIGH');
  });

  it('audit event detailsJson includes userId of affected seller', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Original action stands.',
    });

    const insertArgs = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    const details = insertArgs?.detailsJson as Record<string, unknown>;
    expect(details?.userId).toBe(USER_ID);
    expect(details?.decision).toBe('DENIED');
    expect(details?.reviewNote).toBe('Original action stands.');
  });
});
