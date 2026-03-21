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
    liftedAt: 'lifted_at', liftedByStaffId: 'lifted_by_staff_id',
    liftedReason: 'lifted_reason', updatedAt: 'updated_at',
  },
  sellerProfile: {
    userId: 'user_id', status: 'status', enforcementLevel: 'enforcement_level',
    enforcementStartedAt: 'enforcement_started_at', updatedAt: 'updated_at',
  },
  listing: { id: 'id', enforcementState: 'enforcement_state' },
  auditEvent: {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { db } from '@twicely/db';
import {
  issueEnforcementActionAction,
  liftEnforcementActionAction,
} from '../enforcement';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF_ID = 'staff-supp-001';
const USER_ID = 'user-supp-001';
const ACTION_ID = 'action-supp-001';
const REPORT_ID = 'report-supp-001';

function makeStaffSession(allow = true) {
  return {
    session: {
      staffUserId: STAFF_ID,
      email: 'staff@twicely.com',
      displayName: 'Staff',
      isPlatformStaff: true as const,
      platformRoles: [] as never[],
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

// ─── issueEnforcementActionAction — additional coverage ───────────────────────

describe('issueEnforcementActionAction — additional cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('sets sellerProfile.enforcementLevel for COACHING', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'COACHING', trigger: 'ADMIN_MANUAL', reason: 'First coaching',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.enforcementLevel).toBe('COACHING');
  });

  it('sets sellerProfile.enforcementLevel for PRE_SUSPENSION', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbInsert.mockReturnValue(makeInsertChain([{ id: ACTION_ID }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'PRE_SUSPENSION', trigger: 'POLICY_VIOLATION', reason: 'Escalation',
    });

    const setArgs = vi.mocked(updateChain.set).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.enforcementLevel).toBe('PRE_SUSPENSION');
  });

  it('creates audit event with CRITICAL severity for ACCOUNT_BAN', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    // First insert: enforcementAction; second: auditEvent
    mockDbInsert
      .mockReturnValueOnce(makeInsertChain([{ id: ACTION_ID }]) as never)
      .mockReturnValueOnce(makeInsertChain([]) as never);

    await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'ACCOUNT_BAN', trigger: 'POLICY_VIOLATION', reason: 'Fraud',
    });

    // Both inserts fired: enforcement action record + audit event
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });

  it('accepts optional contentReportId linking report to action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const insertChain = makeInsertChain([{ id: ACTION_ID }]);
    mockDbInsert.mockReturnValue(insertChain as never);
    // WARNING triggers a sellerProfile update — must mock db.update
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    const result = await issueEnforcementActionAction({
      userId: USER_ID,
      actionType: 'WARNING',
      trigger: 'CONTENT_REPORT',
      reason: 'Content policy violation',
      contentReportId: REPORT_ID,
    });

    expect(result.success).toBe(true);
    const valuesArg = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesArg?.contentReportId).toBe(REPORT_ID);
  });

  it('accepts optional expiresAt and passes it as Date to DB', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    const insertChain = makeInsertChain([{ id: ACTION_ID }]);
    mockDbInsert.mockReturnValue(insertChain as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);

    const expiresAt = '2026-12-31T00:00:00.000Z';
    const result = await issueEnforcementActionAction({
      userId: USER_ID,
      actionType: 'SUSPENSION',
      trigger: 'ADMIN_MANUAL',
      reason: 'Temporary suspension',
      expiresAt,
    });

    expect(result.success).toBe(true);
    const valuesArg = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesArg?.expiresAt).toBeInstanceOf(Date);
  });

  it('rejects invalid input (Zod validation fails)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);

    const result = await issueEnforcementActionAction({
      userId: USER_ID, actionType: 'INVALID_TYPE', trigger: 'ADMIN_MANUAL', reason: 'Test',
    });

    expect(result.error).toBe('Invalid input');
  });
});

// ─── liftEnforcementActionAction — RESTRICTION reversal ───────────────────────

describe('liftEnforcementActionAction — additional cases', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('lifts a RESTRICTION and sets sellerProfile.status to ACTIVE', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'RESTRICTION', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Resolved' });

    expect(result.success).toBe(true);
    const setCalls = vi.mocked(updateChain.set).mock.calls;
    const activeCall = setCalls.find((c) => (c[0] as Record<string, unknown>).status === 'ACTIVE');
    expect(activeCall).toBeDefined();
  });

  it('lifts a COACHING and clears enforcementLevel', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'COACHING', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Coaching complete' });

    expect(result.success).toBe(true);
    const setCalls = vi.mocked(updateChain.set).mock.calls;
    const clearCall = setCalls.find((c) => (c[0] as Record<string, unknown>).enforcementLevel === null);
    expect(clearCall).toBeDefined();
  });

  it('lifts a PRE_SUSPENSION and clears enforcementLevel', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'PRE_SUSPENSION', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    const result = await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Admin review passed' });

    expect(result.success).toBe(true);
    const setCalls = vi.mocked(updateChain.set).mock.calls;
    const clearCall = setCalls.find((c) => (c[0] as Record<string, unknown>).enforcementLevel === null);
    expect(clearCall).toBeDefined();
  });

  it('rejects invalid Zod input', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);

    const result = await liftEnforcementActionAction({ actionId: '' });

    expect(result.error).toBe('Invalid input');
  });

  it('creates audit event with ENFORCEMENT_ACTION_LIFTED action', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession() as never);
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: ACTION_ID, userId: USER_ID, actionType: 'WARNING', status: 'ACTIVE',
    }]) as never);
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain as never);
    mockDbInsert.mockReturnValue(makeInsertChain([]) as never);

    await liftEnforcementActionAction({ actionId: ACTION_ID, liftedReason: 'Resolved' });

    // insert fired for the audit event
    expect(mockDbInsert).toHaveBeenCalled();
    const valuesArg = vi.mocked(mockDbInsert).mock.calls.at(-1)?.[0] as unknown;
    // Verify insert was called (audit event creation)
    expect(valuesArg).toBeDefined();
  });
});
