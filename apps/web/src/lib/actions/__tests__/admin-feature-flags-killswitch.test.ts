/**
 * Kill Switch Audit Severity + Cache Invalidation Tests (G10.4)
 * Verifies that toggle/update/delete actions:
 *   - Use CRITICAL severity for kill.* flag toggles
 *   - Use HIGH severity for gate.* and regular flag toggles
 *   - Call cache invalidation after every DB write
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

function makeAdminSession() {
  return {
    session: { staffUserId: 'staff-admin-1' },
    ability: { can: () => true },
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

function chainDelete() {
  return { where: vi.fn().mockResolvedValue([]) };
}

function makeFlag(key: string, enabled = true) {
  return {
    id: 'flag-1',
    key,
    name: 'Test Flag',
    enabled,
    type: 'BOOLEAN',
    description: null,
    percentage: null,
    targetingJson: {},
    createdByStaffId: 'staff-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── toggleFeatureFlagAction ──────────────────────────────────────────────────

describe('toggleFeatureFlagAction — audit severity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockInvalidateFlagCache.mockResolvedValue(undefined);
  });

  it('uses CRITICAL severity for kill.* flag toggle', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('kill.checkout', true)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    await toggleFeatureFlagAction({ flagId: 'flag-1' });

    const insertCall = mockInsertValues.mock.calls[0]?.[0];
    expect(insertCall?.severity).toBe('CRITICAL');
  });

  it('uses HIGH severity for gate.* flag toggle', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('gate.marketplace', false)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    await toggleFeatureFlagAction({ flagId: 'flag-1' });

    const insertCall = mockInsertValues.mock.calls[0]?.[0];
    expect(insertCall?.severity).toBe('HIGH');
  });

  it('uses HIGH severity for regular flag toggle', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('feature.newSearch', true)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    const mockInsertValues = vi.fn().mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: mockInsertValues });

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    await toggleFeatureFlagAction({ flagId: 'flag-1' });

    const insertCall = mockInsertValues.mock.calls[0]?.[0];
    expect(insertCall?.severity).toBe('HIGH');
  });

  it('calls cache invalidation after toggle', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('kill.checkout', true)]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { toggleFeatureFlagAction } = await import('../admin-feature-flags');
    await toggleFeatureFlagAction({ flagId: 'flag-1' });

    expect(mockInvalidateFlagCache).toHaveBeenCalledWith('kill.checkout');
  });
});

// ─── updateFeatureFlagAction ──────────────────────────────────────────────────

describe('updateFeatureFlagAction — cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockInvalidateFlagCache.mockResolvedValue(undefined);
  });

  it('calls cache invalidation after update', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('kill.payouts')]));
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { updateFeatureFlagAction } = await import('../admin-feature-flags');
    await updateFeatureFlagAction({ flagId: 'flag-1', enabled: false });

    expect(mockInvalidateFlagCache).toHaveBeenCalledWith('kill.payouts');
  });
});

// ─── deleteFeatureFlagAction ──────────────────────────────────────────────────

describe('deleteFeatureFlagAction — cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStaffAuthorize.mockResolvedValue(makeAdminSession());
    mockInvalidateFlagCache.mockResolvedValue(undefined);
  });

  it('calls cache invalidation after delete', async () => {
    mockDbSelect.mockReturnValue(chainSelect([makeFlag('gate.marketplace')]));
    mockDbDelete.mockReturnValue(chainDelete());
    mockDbInsert.mockReturnValue(chainInsert());

    const { deleteFeatureFlagAction } = await import('../admin-feature-flags');
    await deleteFeatureFlagAction({ flagId: 'flag-1' });

    expect(mockInvalidateFlagCache).toHaveBeenCalledWith('gate.marketplace');
  });
});
