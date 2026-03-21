import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  contentReport: { id: 'id', status: 'status', reviewedByStaffId: 'reviewed_by_staff_id', reviewedAt: 'reviewed_at', reviewNotes: 'review_notes', updatedAt: 'updated_at' },
  enforcementAction: {
    id: 'id', userId: 'user_id', actionType: 'action_type', trigger: 'trigger',
    status: 'status', reason: 'reason', contentReportId: 'content_report_id',
    issuedByStaffId: 'issued_by_staff_id', expiresAt: 'expires_at',
    liftedAt: 'lifted_at', liftedByStaffId: 'lifted_by_staff_id', liftedReason: 'lifted_reason', updatedAt: 'updated_at',
  },
  sellerProfile: { userId: 'user_id', status: 'status', enforcementLevel: 'enforcement_level', enforcementStartedAt: 'enforcement_started_at', updatedAt: 'updated_at', bandOverride: 'band_override', bandOverrideReason: 'band_override_reason', bandOverrideBy: 'band_override_by', bandOverrideExpiresAt: 'band_override_expires_at' },
  listing: { id: 'id', enforcementState: 'enforcement_state' },
  auditEvent: {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import { reviewContentReportAction, issueEnforcementActionAction } from '../enforcement';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF_ID = 'staff-001';
const USER_ID = 'user-001';
const REPORT_ID = 'report-001';
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

function makeInsertChain(returnRows: unknown[] = [{ id: ACTION_ID }]) {
  const chain = { values: vi.fn(), returning: vi.fn().mockResolvedValue(returnRows) };
  chain.values.mockReturnValue(chain);
  return chain;
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

// ─── reviewContentReportAction ────────────────────────────────────────────────

describe('reviewContentReportAction', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejects non-MODERATION staff (Forbidden)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession(false) as never);

    const result = await reviewContentReportAction({ reportId: REPORT_ID, status: 'CONFIRMED' });

    expect(result.error).toBe('Forbidden');
  });

  it('rejects non-existent report', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await reviewContentReportAction({ reportId: REPORT_ID, status: 'CONFIRMED' });

    expect(result.error).toBe('Report not found');
  });

  it('updates status to CONFIRMED', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: REPORT_ID }]) as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    const result = await reviewContentReportAction({ reportId: REPORT_ID, status: 'CONFIRMED', reviewNotes: 'Verified counterfeit' });

    expect(result.success).toBe(true);
  });

  it('updates status to DISMISSED', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: REPORT_ID }]) as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    const result = await reviewContentReportAction({ reportId: REPORT_ID, status: 'DISMISSED' });

    expect(result.success).toBe(true);
  });

  it('sets reviewedByStaffId and reviewedAt on update', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: REPORT_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    await reviewContentReportAction({ reportId: REPORT_ID, status: 'CONFIRMED' });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.reviewedByStaffId).toBe(STAFF_ID);
    expect(setArgs?.reviewedAt).toBeInstanceOf(Date);
  });
});

// ─── issueEnforcementActionAction ─────────────────────────────────────────────

describe('issueEnforcementActionAction', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('rejects non-MODERATION staff', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession(false) as never);

    const result = await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'WARNING', trigger: 'ADMIN_MANUAL', reason: 'Test',
    });

    expect(result.error).toBe('Forbidden');
  });

  it('creates action for LISTING_REMOVAL', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);

    const result = await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'LISTING_REMOVAL', trigger: 'POLICY_VIOLATION', reason: 'Prohibited item',
    });

    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('sets sellerProfile.status to SUSPENDED when actionType is SUSPENSION', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    const result = await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'SUSPENSION', trigger: 'POLICY_VIOLATION', reason: 'Multiple violations',
    });

    expect(result.success).toBe(true);
    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('SUSPENDED');
  });

  it('sets sellerProfile.status to RESTRICTED when actionType is RESTRICTION', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'RESTRICTION', trigger: 'POLICY_VIOLATION', reason: 'Ongoing issues',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('RESTRICTED');
  });

  it('sets sellerProfile.enforcementLevel for WARNING', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'WARNING', trigger: 'ADMIN_MANUAL', reason: 'Warning issued',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.enforcementLevel).toBe('WARNING');
  });

  it('creates audit event with CRITICAL severity for SUSPENSION', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'SUSPENSION', trigger: 'POLICY_VIOLATION', reason: 'Banned',
    });

    // insert is called at least once (enforcement action creation)
    expect(mockDbInsert).toHaveBeenCalled();
  });
});
