/**
 * Admin Policy Version Action Tests (I14)
 * Covers updatePolicyVersionAction.
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
  platformSetting: { key: 'key', value: 'value', updatedAt: 'updated_at' },
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

// ─── updatePolicyVersionAction ────────────────────────────────────────────────

describe('updatePolicyVersionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates terms version and returns success', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    const result = await updatePolicyVersionAction('terms', '2.0.0');

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('updates both version and effectiveDate settings', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    await updatePolicyVersionAction('privacy', '1.1.0');

    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('inserts an audit event after updating', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertChain = chainInsert();
    mockDbInsert.mockReturnValue(insertChain);

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    await updatePolicyVersionAction('refund', '3.0.0');

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.policy.version_updated' })
    );
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    const result = await updatePolicyVersionAction('terms', '2.0.0');

    expect(result).toEqual({ error: 'Forbidden' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns error for empty version string', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    const result = await updatePolicyVersionAction('terms', '');

    expect(result).toEqual({ error: 'Invalid version' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns error for whitespace-only version string', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    const result = await updatePolicyVersionAction('terms', '   ');

    expect(result).toEqual({ error: 'Invalid version' });
  });

  it('calls revalidatePath for /policies on success', async () => {
    const { revalidatePath } = await import('next/cache');
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    await updatePolicyVersionAction('seller-agreement', '1.5.0');

    expect(revalidatePath).toHaveBeenCalledWith('/policies');
  });

  it('uses actorId from session.staffUserId in audit event', async () => {
    mockStaffAuthorize.mockResolvedValue({ session: { staffUserId: 'staff-42' }, ability: { can: () => true } });
    mockDbUpdate.mockReturnValue(chainUpdate());
    const insertChain = chainInsert();
    mockDbInsert.mockReturnValue(insertChain);

    const { updatePolicyVersionAction } = await import('../admin-policy-version');
    await updatePolicyVersionAction('privacy', '2.2.0');

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'staff-42' })
    );
  });
});
