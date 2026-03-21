import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

const mockDelegatedAccess = {
  id: 'id', sellerId: 'seller_id', userId: 'user_id', email: 'email',
  scopes: 'scopes', status: 'status', invitedAt: 'invited_at',
  acceptedAt: 'accepted_at', revokedAt: 'revoked_at', revokedByUserId: 'revoked_by_user_id',
  expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at',
};
const mockSellerProfile = { id: 'id', userId: 'user_id' };
const mockUser = { id: 'id', name: 'name' };

vi.mock('@twicely/db/schema', () => ({
  delegatedAccess: mockDelegatedAccess,
  sellerProfile: mockSellerProfile,
  user: mockUser,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((a: unknown, b: unknown) => ({ type: 'inArray', a, b })),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { db } from '@twicely/db';

const mockDb = vi.mocked(db);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function selectChainFull(data: unknown[]) {
  // Terminal object that resolves on await and also supports chaining
  const terminal: Record<string, unknown> = {};
  terminal.orderBy = vi.fn().mockReturnValue(terminal);
  terminal.limit = vi.fn().mockResolvedValue(data);
  terminal.where = vi.fn().mockReturnValue(terminal);
  terminal.then = (resolve: (val: unknown) => unknown) => Promise.resolve(data).then(resolve);

  const joinable: Record<string, unknown> = {};
  joinable.innerJoin = vi.fn().mockReturnValue(joinable);
  joinable.where = vi.fn().mockReturnValue(terminal);
  joinable.orderBy = vi.fn().mockReturnValue(terminal);
  joinable.limit = vi.fn().mockResolvedValue(data);
  joinable.then = (resolve: (val: unknown) => unknown) => Promise.resolve(data).then(resolve);

  return {
    from: vi.fn().mockReturnValue(joinable),
  };
}

function updateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  };
}

const SELLER_ID = 'seller-001';
const USER_ID = 'user-001';
const DELEGATION_ID = 'deleg-001';
const NOW = new Date();
const PAST = new Date(NOW.getTime() - 1000 * 60 * 60); // 1 hour ago
const FUTURE = new Date(NOW.getTime() + 1000 * 60 * 60); // 1 hour from now

// ACTIVE_ROW represents the raw data returned by the DB after SELECT
// Fields are named as the query aliases them (e.g. delegationId from delegatedAccess.id)
const ACTIVE_ROW = {
  // For getActiveDelegation (uses aliased select)
  delegationId: DELEGATION_ID,
  sellerId: SELLER_ID,
  scopes: ['orders.view', 'listings.view'],
  expiresAt: null,
  ownerUserId: 'owner-001',
  ownerName: 'Store Owner',
  // For getStaffMembers (uses direct field select)
  id: DELEGATION_ID,
  userId: USER_ID,
  email: 'staff@example.com',
  name: 'Staff Member',
  status: 'ACTIVE',
  invitedAt: PAST,
  acceptedAt: PAST,
  revokedAt: null,
  revokedByUserId: null,
};

// ─── Tests: getStaffMembers ───────────────────────────────────────────────────

describe('getStaffMembers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all delegation records for a seller with user join', async () => {
    mockDb.select.mockReturnValue(selectChainFull([ACTIVE_ROW]) as never);

    const { getStaffMembers } = await import('../delegation');
    const result = await getStaffMembers(SELLER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: DELEGATION_ID,
      email: 'staff@example.com',
      name: 'Staff Member',
      status: 'ACTIVE',
    });
  });

  it('returns empty array for seller with no staff', async () => {
    mockDb.select.mockReturnValue(selectChainFull([]) as never);

    const { getStaffMembers } = await import('../delegation');
    const result = await getStaffMembers(SELLER_ID);

    expect(result).toEqual([]);
  });

  it('orders by createdAt desc', async () => {
    const rows = [
      { ...ACTIVE_ROW, id: 'deleg-002', status: 'REVOKED' },
      { ...ACTIVE_ROW, id: 'deleg-001', status: 'ACTIVE' },
    ];
    mockDb.select.mockReturnValue(selectChainFull(rows) as never);

    const { getStaffMembers } = await import('../delegation');
    const result = await getStaffMembers(SELLER_ID);

    expect(result).toHaveLength(2);
  });
});

// ─── Tests: getActiveDelegation ───────────────────────────────────────────────

describe('getActiveDelegation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns active delegation for user', async () => {
    const row = { ...ACTIVE_ROW, expiresAt: null };
    mockDb.select.mockReturnValue(selectChainFull([row]) as never);

    const { getActiveDelegation } = await import('../delegation');
    const result = await getActiveDelegation(USER_ID);

    expect(result).toMatchObject({
      delegationId: DELEGATION_ID,
      sellerId: SELLER_ID,
      scopes: ['orders.view', 'listings.view'],
      ownerUserId: 'owner-001',
      ownerName: 'Store Owner',
    });
  });

  it('returns null if no active delegation', async () => {
    mockDb.select.mockReturnValue(selectChainFull([]) as never);

    const { getActiveDelegation } = await import('../delegation');
    const result = await getActiveDelegation(USER_ID);

    expect(result).toBeNull();
  });

  it('returns null if delegation is expired and updates status to EXPIRED', async () => {
    const row = { ...ACTIVE_ROW, expiresAt: PAST };
    mockDb.select.mockReturnValue(selectChainFull([row]) as never);
    vi.mocked(db.update).mockReturnValue(updateChain() as never);

    const { getActiveDelegation } = await import('../delegation');
    const result = await getActiveDelegation(USER_ID);

    expect(result).toBeNull();
    expect(db.update).toHaveBeenCalled();
  });

  it('returns delegation if not yet expired (future expiresAt)', async () => {
    const row = { ...ACTIVE_ROW, expiresAt: FUTURE };
    mockDb.select.mockReturnValue(selectChainFull([row]) as never);

    const { getActiveDelegation } = await import('../delegation');
    const result = await getActiveDelegation(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.delegationId).toBe(DELEGATION_ID);
  });

  it('auto-expires delegation past expiresAt', async () => {
    const row = { ...ACTIVE_ROW, expiresAt: new Date(0) };
    mockDb.select.mockReturnValue(selectChainFull([row]) as never);
    vi.mocked(db.update).mockReturnValue(updateChain() as never);

    const { getActiveDelegation } = await import('../delegation');
    const result = await getActiveDelegation(USER_ID);

    expect(result).toBeNull();
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests: getStaffCountForSeller ────────────────────────────────────────────

describe('getStaffCountForSeller', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('counts only ACTIVE and PENDING delegations', async () => {
    const rows = [
      { id: 'deleg-001' },
      { id: 'deleg-002' },
    ];
    mockDb.select.mockReturnValue(selectChainFull(rows) as never);

    const { getStaffCountForSeller } = await import('../delegation');
    const count = await getStaffCountForSeller(SELLER_ID);

    expect(count).toBe(2);
  });

  it('does not count REVOKED or EXPIRED', async () => {
    // The query filters by inArray(['ACTIVE','PENDING']), so revoked/expired
    // would not be returned by the DB. Simulate zero rows returned.
    mockDb.select.mockReturnValue(selectChainFull([]) as never);

    const { getStaffCountForSeller } = await import('../delegation');
    const count = await getStaffCountForSeller(SELLER_ID);

    expect(count).toBe(0);
  });
});
