/**
 * Admin Feature Flag Actions — Authorization and Toggle Error Paths (G10.4)
 * Covers forbidden access, flag-not-found for createFeatureFlagAction
 * and toggleFeatureFlagAction.
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
  delete: vi.fn(),
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
  return { values: vi.fn().mockResolvedValue([{ id: 'new-flag-id' }]) };
}

function chainInsertReturning() {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'new-flag-id' }]),
    }),
  };
}

function makeFlag(key: string, enabled = true) {
  return {
    id: 'flag-test-1', key, name: 'Test Flag', enabled,
    type: 'BOOLEAN', description: null, percentage: null,
    targetingJson: {}, createdByStaffId: 'staff-1',
    createdAt: new Date(), updatedAt: new Date(),
  };
}

// ─── createFeatureFlagAction — authorization ──────────────────────────────────

describe('createFeatureFlagAction — authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when ability.can(create) is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false, true, true));

    const { createFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await createFeatureFlagAction({
      key: 'test.flag', name: 'Test', type: 'BOOLEAN', enabled: true,
    });

    expect(result).toEqual({ error: 'Forbidden' });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns error when key already exists', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([{ id: 'existing-id' }]));

    const { createFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await createFeatureFlagAction({
      key: 'kill.checkout', name: 'Checkout', type: 'BOOLEAN', enabled: true,
    });

    expect(result).toEqual({ error: 'A flag with this key already exists' });
  });

  it('creates flag and returns success with id when key is unique', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));
    mockDbInsert
      .mockReturnValueOnce(chainInsertReturning())
      .mockReturnValueOnce(chainInsert());

    const { createFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await createFeatureFlagAction({
      key: 'feature.newSomething', name: 'New Something', type: 'BOOLEAN', enabled: false,
    });

    expect(result).toMatchObject({ success: true, id: 'new-flag-id' });
  });
});

// ─── toggleFeatureFlagAction — error paths ────────────────────────────────────

describe('toggleFeatureFlagAction — error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockInvalidateFlagCache.mockResolvedValue(undefined);
  });

  it('returns Forbidden when ability.can(update) is false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(true, false, true));

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await toggleFeatureFlagAction({ flagId: 'flag-1' });

    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns error when flag not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await toggleFeatureFlagAction({ flagId: 'nonexistent-id' });

    expect(result).toEqual({ error: 'Flag not found' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('toggles enabled state (true → false)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('kill.checkout', true)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await toggleFeatureFlagAction({ flagId: 'flag-test-1' });

    expect(result).toMatchObject({ success: true, enabled: false });
  });

  it('toggles enabled state (false → true)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('gate.marketplace', false)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    const result = await toggleFeatureFlagAction({ flagId: 'flag-test-1' });

    expect(result).toMatchObject({ success: true, enabled: true });
  });

  it('does not call invalidateFlagCache when flag not found', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(chainSelect([]));

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    await toggleFeatureFlagAction({ flagId: 'nonexistent-id' });

    expect(mockInvalidateFlagCache).not.toHaveBeenCalled();
  });
});
