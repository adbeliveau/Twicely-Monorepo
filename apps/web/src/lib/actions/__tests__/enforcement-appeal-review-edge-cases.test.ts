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

const USER_ID = 'user-rev-001';
const STAFF_ID = 'staff-rev-001';
const ACTION_ID = 'action-rev-001';

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

// ─── Auth / staff-authorize edge cases ─────────────────────────────────────────

describe('reviewEnforcementAppealAction — auth edge cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns Forbidden when staffAuthorize throws (unauthenticated staff)', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Unauthenticated') as never);

    await expect(
      reviewEnforcementAppealAction({
        enforcementActionId: ACTION_ID,
        decision: 'APPROVED',
        reviewNote: 'Reviewing the appeal.',
      })
    ).rejects.toThrow();
  });

  it('returns Forbidden when CONTENT role lacks update on EnforcementAction', async () => {
    const session = makeStaffSession(false);
    mockStaffAuthorize.mockResolvedValue(session as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Content role should not review appeals.',
    });
    expect(result.error).toBe('Forbidden');
  });
});

// ─── Input validation edge cases ───────────────────────────────────────────────

describe('reviewEnforcementAppealAction — input validation edge cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejects invalid decision value (not APPROVED/DENIED)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'PARTIAL',
      reviewNote: 'Partial decision not allowed.',
    });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects missing enforcementActionId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);

    const result = await reviewEnforcementAppealAction({
      decision: 'APPROVED',
      reviewNote: 'Missing action ID.',
    });
    expect(result.error).toBe('Invalid input');
  });

  it('rejects extra/unknown fields (strict schema)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Valid review note.',
      extraField: 'injected',
    });
    expect(result.error).toBe('Invalid input');
  });

  it('returns Not found when action does not exist in DB', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: 'nonexistent-action',
      decision: 'APPROVED',
      reviewNote: 'Action should not exist.',
    });
    expect(result.error).toBe('Not found');
  });

  it('rejects reviewing action with status APPEAL_APPROVED (already resolved)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeAppealedAction({ status: 'APPEAL_APPROVED' })]) as never
    );

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'APPROVED',
      reviewNote: 'Trying to re-approve already resolved appeal.',
    });
    expect(result.error).toBe('Only appealed actions can be reviewed');
  });

  it('rejects reviewing action with status EXPIRED', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeAppealedAction({ status: 'EXPIRED' })]) as never
    );

    const result = await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Expired action cannot be reviewed.',
    });
    expect(result.error).toBe('Only appealed actions can be reviewed');
  });
});

// ─── Denial side-effect verification ──────────────────────────────────────────

describe('reviewEnforcementAppealAction — denial side effects', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('on denial: sets appealResolvedAt in the update payload', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Original action was correct.',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.appealResolvedAt).toBeInstanceOf(Date);
  });

  it('on denial: sets appealReviewNote in the update payload', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction()]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    const note = 'Original action upheld after careful review.';
    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: note,
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.appealReviewNote).toBe(note);
    expect(setArgs?.appealReviewedByStaffId).toBe(STAFF_ID);
  });

  it('on denial: does NOT update sellerProfile or listing', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([makeAppealedAction({ actionType: 'SUSPENSION' })]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain() as never);

    await reviewEnforcementAppealAction({
      enforcementActionId: ACTION_ID,
      decision: 'DENIED',
      reviewNote: 'Suspension upheld.',
    });

    // Only one update call: enforcementAction itself (no sellerProfile restore)
    expect(vi.mocked(mockDbUpdate)).toHaveBeenCalledTimes(1);
  });
});

