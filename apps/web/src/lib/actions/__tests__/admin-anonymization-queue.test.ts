/**
 * Admin Anonymization Queue Action Tests (I13)
 * Covers forceAnonymizeUserAction, cancelDeletionRequestAction,
 * and processOverdueDeletionsAction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
  insert: mockDbInsert,
};
const mockStaffAuthorize = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }));
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));
vi.mock('@twicely/casl', () => ({
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ForbiddenError'; }
  },
}));
vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', name: 'name', email: 'email', deletionRequestedAt: 'deletion_requested_at', anonymizedAt: 'anonymized_at' },
  auditEvent: {},
}));
vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ type: 'eq' }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  isNotNull: (_a: unknown) => ({ type: 'isNotNull' }),
  isNull: (_a: unknown) => ({ type: 'isNull' }),
  lt: (_a: unknown, _b: unknown) => ({ type: 'lt' }),
}));

vi.mock('../staff-mfa', () => ({
  requireMfaForCriticalAction: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminSession() {
  return {
    session: { staffUserId: 'staff-admin-1' },
    ability: { can: () => true },
  };
}

function makeDeniedSession() {
  return {
    session: { staffUserId: 'staff-viewer-1' },
    ability: { can: () => false },
  };
}

function chainSelect(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function chainUpdate() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function makeUserWithDeletion() {
  return { id: 'user-abc', deletionRequestedAt: new Date('2026-01-01') };
}

// ─── forceAnonymizeUserAction ─────────────────────────────────────────────────

describe('forceAnonymizeUserAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
  });

  it('requires DataRetention manage ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeDeniedSession());

    const { forceAnonymizeUserAction } = await import('../admin-anonymization-queue');

    await expect(forceAnonymizeUserAction('user-abc')).rejects.toThrow();
  });

  it('updates user name and email on success', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeUserWithDeletion()]));
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockSet, where: mockWhere });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDbInsert.mockReturnValue(chainInsert());

    const { forceAnonymizeUserAction } = await import('../admin-anonymization-queue');
    const result = await forceAnonymizeUserAction('user-abc');

    expect(result).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Deleted User' })
    );
  });

  it('writes audit event with HIGH severity', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeUserWithDeletion()]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { forceAnonymizeUserAction } = await import('../admin-anonymization-queue');
    await forceAnonymizeUserAction('user-abc');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.user.force_anonymized',
        severity: 'HIGH',
        subject: 'User',
      })
    );
  });

  it('calls revalidatePath after success', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeUserWithDeletion()]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { forceAnonymizeUserAction } = await import('../admin-anonymization-queue');
    await forceAnonymizeUserAction('user-abc');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/cfg/data-retention/anonymize');
  });

  it('returns error when user not found', async () => {
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { forceAnonymizeUserAction } = await import('../admin-anonymization-queue');
    const result = await forceAnonymizeUserAction('nonexistent');

    expect(result).toEqual({ error: 'User not found' });
  });
});

// ─── cancelDeletionRequestAction ──────────────────────────────────────────────

describe('cancelDeletionRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
  });

  it('requires DataRetention manage ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeDeniedSession());

    const { cancelDeletionRequestAction } = await import('../admin-anonymization-queue');

    await expect(cancelDeletionRequestAction('user-abc')).rejects.toThrow();
  });

  it('clears deletionRequestedAt on success', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeUserWithDeletion()]));
    const mockSet = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({ set: mockSet, where: mockWhere });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDbInsert.mockReturnValue(chainInsert());

    const { cancelDeletionRequestAction } = await import('../admin-anonymization-queue');
    const result = await cancelDeletionRequestAction('user-abc');

    expect(result).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ deletionRequestedAt: null })
    );
  });

  it('writes audit event with MEDIUM severity', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeUserWithDeletion()]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { cancelDeletionRequestAction } = await import('../admin-anonymization-queue');
    await cancelDeletionRequestAction('user-abc');

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.user.deletion_cancelled',
        severity: 'MEDIUM',
      })
    );
  });
});

// ─── processOverdueDeletionsAction ───────────────────────────────────────────

describe('processOverdueDeletionsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
  });

  it('requires DataRetention manage ability', async () => {
    mockStaffAuthorize.mockResolvedValue(makeDeniedSession());

    const { processOverdueDeletionsAction } = await import('../admin-anonymization-queue');

    await expect(processOverdueDeletionsAction()).rejects.toThrow();
  });

  it('processes overdue users and returns count', async () => {
    const overdueBatch = [{ id: 'user-1' }, { id: 'user-2' }];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(overdueBatch),
    });
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { processOverdueDeletionsAction } = await import('../admin-anonymization-queue');
    const result = await processOverdueDeletionsAction();

    expect(result).toEqual({ processed: 2 });
  });

  it('writes bulk audit event when users are processed', async () => {
    const overdueBatch = [{ id: 'user-1' }];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(overdueBatch),
    });
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { processOverdueDeletionsAction } = await import('../admin-anonymization-queue');
    await processOverdueDeletionsAction();

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.bulk.anonymization_processed' })
    );
  });

  it('returns processed: 0 and does not write audit event when batch is empty', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });
    mockDbInsert.mockReturnValue(chainInsert());

    const { processOverdueDeletionsAction } = await import('../admin-anonymization-queue');
    const result = await processOverdueDeletionsAction();

    expect(result).toEqual({ processed: 0 });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});
