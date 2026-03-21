/**
 * Admin Feature Flag Actions — Update and Delete Error Paths (G10.4)
 * Covers forbidden access and flag-not-found for updateFeatureFlagAction
 * and deleteFeatureFlagAction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
  insert: mockDbInsert,
  delete: mockDbDelete,
};
const mockStaffAuthorize = vi.fn();
const mockInvalidateFlagCache = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));
vi.mock('@/lib/services/feature-flags', () => ({
  invalidateFlagCache: (...args: unknown[]) => mockInvalidateFlagCache(...args),
}));
vi.mock('@twicely/db/schema', () => ({
  featureFlag: { id: 'id', key: 'key' },
  auditEvent: {},
}));
vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
}));
vi.mock('@/lib/actions/admin-feature-flag-schemas', () => ({
  createFeatureFlagSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
  updateFeatureFlagSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
  toggleFeatureFlagSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
  deleteFeatureFlagSchema: {
    safeParse: (data: unknown) => ({ success: true, data }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(canCreate = true, canUpdate = true, canDelete = true) {
  return {
    session: { staffUserId: 'staff-test-1' },
    ability: {
      can: (action: string) => {
        if (action === 'create') return canCreate;
        if (action === 'update') return canUpdate;
        if (action === 'delete') return canDelete;
        return false;
      },
    },
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
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

function chainDelete() {
  return { where: vi.fn().mockResolvedValue([]) };
}

function makeFlag(key: string, enabled = true) {
  return {
    id: 'flag-test-1', key, name: 'Test Flag', enabled,
    type: 'BOOLEAN', description: null, percentage: null,
    targetingJson: {}, createdByStaffId: 'staff-1',
    createdAt: new Date(), updatedAt: new Date(),
  };
}

// ─── updateFeatureFlagAction — error paths ────────────────────────────────────

describe('updateFeatureFlagAction — error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockInvalidateFlagCache.mockResolvedValue(undefined);
  });

  it('returns Forbidden when ability.can(update) is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(true, false, true));

    const { updateFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await updateFeatureFlagAction({ flagId: 'flag-1', name: 'New Name' });

    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns error when flag not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { updateFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await updateFeatureFlagAction({ flagId: 'no-flag', enabled: true });

    expect(result).toEqual({ error: 'Flag not found' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('does not call invalidateFlagCache when flag not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { updateFeatureFlagAction } = await import('../admin-feature-flags');
    await updateFeatureFlagAction({ flagId: 'no-flag', enabled: true });

    expect(mockInvalidateFlagCache).not.toHaveBeenCalled();
  });

  it('updates flag and returns success when flag exists', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('kill.checkout')]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { updateFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await updateFeatureFlagAction({ flagId: 'flag-test-1', enabled: false });

    expect(result).toEqual({ success: true });
  });

  it('calls invalidateFlagCache with the flag key after successful update', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('gate.helpdesk', false)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { updateFeatureFlagAction } = await import('../admin-feature-flags');
    await updateFeatureFlagAction({ flagId: 'flag-test-1', enabled: true });

    expect(mockInvalidateFlagCache).toHaveBeenCalledWith('gate.helpdesk');
  });
});

// ─── deleteFeatureFlagAction — error paths ────────────────────────────────────

describe('deleteFeatureFlagAction — error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockInvalidateFlagCache.mockResolvedValue(undefined);
  });

  it('returns Forbidden when ability.can(delete) is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(true, true, false));

    const { deleteFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await deleteFeatureFlagAction({ flagId: 'flag-1' });

    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns error when flag not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { deleteFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await deleteFeatureFlagAction({ flagId: 'no-flag' });

    expect(result).toEqual({ error: 'Flag not found' });
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  it('deletes flag and returns success when flag exists', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('feature.test', true)]));
    mockDbDelete.mockReturnValue(chainDelete());
    mockDbInsert.mockReturnValue(chainInsert());

    const { deleteFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await deleteFeatureFlagAction({ flagId: 'flag-test-1' });

    expect(result).toEqual({ success: true });
  });

  it('does not call invalidateFlagCache when flag not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { deleteFeatureFlagAction } = await import('../admin-feature-flags');
    await deleteFeatureFlagAction({ flagId: 'no-flag' });

    expect(mockInvalidateFlagCache).not.toHaveBeenCalled();
  });

  it('calls invalidateFlagCache with the flag key after successful delete', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('kill.payouts', true)]));
    mockDbDelete.mockReturnValue(chainDelete());
    mockDbInsert.mockReturnValue(chainInsert());

    const { deleteFeatureFlagAction } = await import('../admin-feature-flags');
    await deleteFeatureFlagAction({ flagId: 'flag-test-1' });

    expect(mockInvalidateFlagCache).toHaveBeenCalledWith('kill.payouts');
  });
});
