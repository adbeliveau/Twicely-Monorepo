/**
 * Admin Delegation Action Tests (I14)
 * Covers adminRevokeDelegationAction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { update: mockDbUpdate, insert: mockDbInsert };
const mockStaffAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));
vi.mock('@twicely/db/schema', () => ({
  delegatedAccess: { id: 'id', status: 'status', revokedAt: 'revoked_at', updatedAt: 'updated_at' },
  auditEvent: {},
}));
vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ type: 'eq' }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(canManage = true) {
  return {
    session: { staffUserId: 'staff-1' },
    ability: {
      can: (_action: string, _subject: string) => canManage,
    },
  };
}

function chainUpdate() {
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

// ─── adminRevokeDelegationAction ──────────────────────────────────────────────

describe('adminRevokeDelegationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('revokes a delegation and returns success', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    const result = await adminRevokeDelegationAction('da-1');

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('inserts an audit event after revoking', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    await adminRevokeDelegationAction('da-2');

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    const result = await adminRevokeDelegationAction('da-1');

    expect(result).toEqual({ error: 'Forbidden' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('does not call insert when forbidden', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    await adminRevokeDelegationAction('da-1');

    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('calls revalidatePath for /delegated-access on success', async () => {
    const { revalidatePath } = await import('next/cache');
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    await adminRevokeDelegationAction('da-3');

    expect(revalidatePath).toHaveBeenCalledWith('/delegated-access');
  });

  it('sets status to REVOKED in DB update', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    const updateChain = chainUpdate();
    mockDbUpdate.mockReturnValue(updateChain);
    mockDbInsert.mockReturnValue(chainInsert());

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    await adminRevokeDelegationAction('da-4');

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REVOKED' })
    );
  });

  it('uses actorId from session.staffUserId in audit event', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: { staffUserId: 'staff-99' }, ability: { can: () => true } });
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertChain = chainInsert();
    mockDbInsert.mockReturnValue(insertChain);

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    await adminRevokeDelegationAction('da-5');

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'staff-99' })
    );
  });

  it('sets audit action to admin.delegation.revoked', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertChain = chainInsert();
    mockDbInsert.mockReturnValue(insertChain);

    const { adminRevokeDelegationAction } = await import('../admin-delegations');
    await adminRevokeDelegationAction('da-6');

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.delegation.revoked' })
    );
  });
});
