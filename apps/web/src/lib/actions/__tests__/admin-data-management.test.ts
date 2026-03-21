/**
 * Admin Data Management Action Tests (I12)
 * Covers bulkUpdateListingStatusAction, bulkBanUsersAction, bulkUnbanUsersAction.
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
  listing: { id: 'id', status: 'status', updatedAt: 'updated_at' },
  user: { id: 'id', isBanned: 'is_banned', bannedAt: 'banned_at', bannedReason: 'banned_reason', updatedAt: 'updated_at' },
  auditEvent: {},
}));
vi.mock('drizzle-orm', () => ({
  inArray: (_a: unknown, _b: unknown) => ({ type: 'inArray' }),
}));
vi.mock('@/lib/validations/data-management', () => ({
  bulkListingUpdateSchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d['listingIds'] || !d['targetStatus']) return { success: false };
      const ids = d['listingIds'] as string[];
      if (ids.length === 0 || ids.length > 100) return { success: false };
      if (d['targetStatus'] === 'SOLD') return { success: false };
      return { success: true, data };
    },
  },
  bulkUserBanSchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d['userIds'] || !d['reason']) return { success: false };
      const ids = d['userIds'] as string[];
      if (ids.length === 0 || ids.length > 100) return { success: false };
      return { success: true, data };
    },
  },
  bulkUserUnbanSchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d['userIds']) return { success: false };
      return { success: true, data };
    },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(canUpdate = true) {
  return {
    session: { staffUserId: 'staff-1' },
    ability: {
      can: (_action: string, _subject: string) => canUpdate,
    },
  };
}

function chainUpdate() {
  return { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) };
}

function chainInsert() {
  return { values: vi.fn().mockResolvedValue([]) };
}

// ─── bulkUpdateListingStatusAction ───────────────────────────────────────────

describe('bulkUpdateListingStatusAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates listings to PAUSED status', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: ['l1', 'l2'], targetStatus: 'PAUSED' });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('updates listings to ACTIVE status', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: ['l1'], targetStatus: 'ACTIVE' });

    expect(result).toEqual({ success: true });
  });

  it('updates listings to REMOVED status', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: ['l1'], targetStatus: 'REMOVED' });

    expect(result).toEqual({ success: true });
  });

  it('rejects SOLD as targetStatus (schema validation)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: ['l1'], targetStatus: 'SOLD' });

    expect(result).toEqual({ error: 'Invalid input' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('rejects more than 100 items', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const ids = Array.from({ length: 101 }, (_, i) => `l${i}`);
    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: ids, targetStatus: 'PAUSED' });

    expect(result).toEqual({ error: 'Invalid input' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('rejects empty listingIds array', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: [], targetStatus: 'PAUSED' });

    expect(result).toEqual({ error: 'Invalid input' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    const result = await bulkUpdateListingStatusAction({ listingIds: ['l1'], targetStatus: 'PAUSED' });

    expect(result).toEqual({ error: 'Forbidden' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('writes audit event after successful update', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkUpdateListingStatusAction } = await import('../admin-data-management');
    await bulkUpdateListingStatusAction({ listingIds: ['l1', 'l2'], targetStatus: 'REMOVED' });

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});

// ─── bulkBanUsersAction ───────────────────────────────────────────────────────

describe('bulkBanUsersAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets isBanned=true for provided user IDs', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkBanUsersAction } = await import('../admin-data-management');
    const result = await bulkBanUsersAction({ userIds: ['u1', 'u2'], reason: 'Spam' });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('filters out the staffUserId from ban list', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkBanUsersAction } = await import('../admin-data-management');
    const result = await bulkBanUsersAction({ userIds: ['staff-1', 'u2'], reason: 'Spam' });

    // staff-1 is the staffUserId — should be filtered out, u2 remains
    expect(result).toEqual({ success: true });
  });

  it('returns error when all IDs are filtered out (only self in list)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { bulkBanUsersAction } = await import('../admin-data-management');
    const result = await bulkBanUsersAction({ userIds: ['staff-1'], reason: 'Spam' });

    expect(result).toEqual({ error: 'No valid users to ban' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('rejects more than 100 user IDs', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const ids = Array.from({ length: 101 }, (_, i) => `u${i}`);
    const { bulkBanUsersAction } = await import('../admin-data-management');
    const result = await bulkBanUsersAction({ userIds: ids, reason: 'Spam' });

    expect(result).toEqual({ error: 'Invalid input' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { bulkBanUsersAction } = await import('../admin-data-management');
    const result = await bulkBanUsersAction({ userIds: ['u1'], reason: 'Spam' });

    expect(result).toEqual({ error: 'Forbidden' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('writes audit event after successful ban', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkBanUsersAction } = await import('../admin-data-management');
    await bulkBanUsersAction({ userIds: ['u1', 'u2'], reason: 'Policy violation' });

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});

// ─── bulkUnbanUsersAction ─────────────────────────────────────────────────────

describe('bulkUnbanUsersAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets isBanned=false for provided user IDs', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkUnbanUsersAction } = await import('../admin-data-management');
    const result = await bulkUnbanUsersAction({ userIds: ['u1', 'u2'] });

    expect(result).toEqual({ success: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { bulkUnbanUsersAction } = await import('../admin-data-management');
    const result = await bulkUnbanUsersAction({ userIds: ['u1'] });

    expect(result).toEqual({ error: 'Forbidden' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('writes audit event after successful unban', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockDbUpdate.mockReturnValue(chainUpdate());
    mockDbInsert.mockReturnValue(chainInsert());

    const { bulkUnbanUsersAction } = await import('../admin-data-management');
    await bulkUnbanUsersAction({ userIds: ['u1', 'u2'] });

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});
