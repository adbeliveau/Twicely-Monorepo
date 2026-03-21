/**
 * Admin Delegation Query Tests (I14)
 * Covers getAdminDelegationKPIs and getAdminDelegations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  delegatedAccess: {
    id: 'id',
    sellerId: 'seller_id',
    userId: 'user_id',
    email: 'email',
    scopes: 'scopes',
    status: 'status',
    invitedAt: 'invited_at',
    acceptedAt: 'accepted_at',
    revokedAt: 'revoked_at',
  },
  sellerProfile: { id: 'id', userId: 'user_id' },
  user: { id: 'id', name: 'name', email: 'email' },
}));
vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ type: 'eq' }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  or: (..._args: unknown[]) => ({ type: 'or' }),
  like: (_a: unknown, _b: unknown) => ({ type: 'like' }),
  count: () => ({ type: 'count' }),
  inArray: (_a: unknown, _b: unknown) => ({ type: 'inArray' }),
}));

// ─── Chain helper ─────────────────────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

const NOW = new Date('2026-01-01T00:00:00Z');

// ─── getAdminDelegationKPIs ───────────────────────────────────────────────────

describe('getAdminDelegationKPIs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct aggregate counts', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ c: 5 }]))   // active
      .mockReturnValueOnce(makeChain([{ c: 2 }]))   // pending
      .mockReturnValueOnce(makeChain([{ c: 3 }]))   // revoked
      .mockReturnValueOnce(makeChain([{ c: 7 }]));  // sellersWithStaff

    const { getAdminDelegationKPIs } = await import('../admin-delegations');
    const result = await getAdminDelegationKPIs();

    expect(result.totalActive).toBe(5);
    expect(result.totalPending).toBe(2);
    expect(result.totalRevoked).toBe(3);
    expect(result.sellersWithStaff).toBe(7);
  });

  it('returns zeros when no delegations exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const { getAdminDelegationKPIs } = await import('../admin-delegations');
    const result = await getAdminDelegationKPIs();

    expect(result.totalActive).toBe(0);
    expect(result.totalPending).toBe(0);
    expect(result.totalRevoked).toBe(0);
    expect(result.sellersWithStaff).toBe(0);
  });

  it('handles undefined DB rows gracefully', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([undefined]))
      .mockReturnValueOnce(makeChain([undefined]))
      .mockReturnValueOnce(makeChain([undefined]))
      .mockReturnValueOnce(makeChain([undefined]));

    const { getAdminDelegationKPIs } = await import('../admin-delegations');
    const result = await getAdminDelegationKPIs();

    expect(result.totalActive).toBe(0);
    expect(result.totalPending).toBe(0);
    expect(result.totalRevoked).toBe(0);
    expect(result.sellersWithStaff).toBe(0);
  });
});

// ─── getAdminDelegations ──────────────────────────────────────────────────────

describe('getAdminDelegations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated rows and total', async () => {
    const row = {
      id: 'da1',
      staffUserId: 'u1',
      staffName: 'Alice',
      staffEmail: 'alice@example.com',
      sellerId: 'sp1',
      sellerUserId: 'u2',
      scopes: ['read', 'write'],
      status: 'ACTIVE',
      invitedAt: NOW,
      acceptedAt: NOW,
      revokedAt: null,
    };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))         // main rows query
      .mockReturnValueOnce(makeChain([{ c: 1 }]))   // total count
      .mockReturnValueOnce(makeChain([{ id: 'u2', name: 'Bob' }])); // seller user lookup

    const { getAdminDelegations } = await import('../admin-delegations');
    const result = await getAdminDelegations({ limit: 50, offset: 0 });

    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.rows[0]?.staffName).toBe('Alice');
    expect(result.rows[0]?.sellerName).toBe('Bob');
  });

  it('returns empty result when no delegations', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const { getAdminDelegations } = await import('../admin-delegations');
    const result = await getAdminDelegations({ limit: 50, offset: 0 });

    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('applies status filter', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const { getAdminDelegations } = await import('../admin-delegations');
    const result = await getAdminDelegations({ status: 'ACTIVE', limit: 50, offset: 0 });

    expect(result.rows).toHaveLength(0);
  });

  it('applies search filter', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const { getAdminDelegations } = await import('../admin-delegations');
    const result = await getAdminDelegations({ search: 'alice', limit: 50, offset: 0 });

    expect(result.rows).toHaveLength(0);
  });

  it('applies combined status + search filter', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ c: 0 }]));

    const { getAdminDelegations } = await import('../admin-delegations');
    const result = await getAdminDelegations({ status: 'REVOKED', search: 'bob', limit: 50, offset: 0 });

    expect(result.rows).toHaveLength(0);
  });

  it('falls back to userId when seller not found in name map', async () => {
    const row = {
      id: 'da2',
      staffUserId: 'u1',
      staffName: 'Carol',
      staffEmail: 'carol@example.com',
      sellerId: 'sp1',
      sellerUserId: 'u-unknown',
      scopes: [],
      status: 'PENDING',
      invitedAt: NOW,
      acceptedAt: null,
      revokedAt: null,
    };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))
      .mockReturnValueOnce(makeChain([{ c: 1 }]))
      .mockReturnValueOnce(makeChain([])); // no seller user found

    const { getAdminDelegations } = await import('../admin-delegations');
    const result = await getAdminDelegations({ limit: 50, offset: 0 });

    expect(result.rows[0]?.sellerName).toBe('u-unknown');
  });
});
