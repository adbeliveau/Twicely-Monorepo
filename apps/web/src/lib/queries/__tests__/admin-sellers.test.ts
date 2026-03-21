/**
 * Admin Seller Queries Tests (I2.1)
 * Covers getAdminSellerList and getAdminVerificationQueue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', name: 'name', email: 'email', username: 'username', isBanned: 'is_banned' },
  sellerProfile: {
    userId: 'user_id', sellerType: 'seller_type', storeTier: 'store_tier',
    listerTier: 'lister_tier', performanceBand: 'performance_band', sellerScore: 'seller_score',
    status: 'status', activatedAt: 'activated_at', verifiedAt: 'verified_at',
    stripeOnboarded: 'stripe_onboarded', enforcementLevel: 'enforcement_level',
  },
  sellerBalance: { userId: 'user_id', availableCents: 'available_cents' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  ilike: (_col: unknown, _val: unknown) => ({ type: 'ilike' }),
  count: () => ({ type: 'count' }),
  desc: (_col: unknown) => ({ type: 'desc' }),
  asc: (_col: unknown) => ({ type: 'asc' }),
  isNull: (_col: unknown) => ({ type: 'isNull' }),
  inArray: (_col: unknown, _vals: unknown) => ({ type: 'inArray' }),
  sql: vi.fn(() => ({ type: 'sql' })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const c: Record<string, unknown> = {};
  c['select'] = vi.fn().mockReturnValue(c);
  c['from'] = vi.fn().mockReturnValue(c);
  c['innerJoin'] = vi.fn().mockReturnValue(c);
  c['leftJoin'] = vi.fn().mockReturnValue(c);
  c['where'] = vi.fn().mockReturnValue(c);
  c['orderBy'] = vi.fn().mockReturnValue(c);
  c['limit'] = vi.fn().mockReturnValue(c);
  c['offset'] = vi.fn().mockResolvedValue(result);
  return c;
}

function makeCountChain(count: number) {
  const c: Record<string, unknown> = {};
  c['from'] = vi.fn().mockReturnValue(c);
  c['innerJoin'] = vi.fn().mockReturnValue(c);
  c['where'] = vi.fn().mockResolvedValue([{ count }]);
  return c;
}

const NOW = new Date('2026-01-01T00:00:00Z');

function makeSellerRow(overrides = {}) {
  return {
    userId: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    sellerType: 'PERSONAL',
    storeTier: 'NONE',
    listerTier: 'FREE',
    performanceBand: 'EMERGING',
    sellerScore: 500,
    status: 'ACTIVE',
    availableCents: 0,
    activatedAt: NOW,
    verifiedAt: null,
    stripeOnboarded: false,
    ...overrides,
  };
}

function makeQueueRow(overrides = {}) {
  return {
    userId: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    sellerType: 'BUSINESS',
    storeTier: 'PRO',
    verifiedAt: null,
    status: 'ACTIVE',
    enforcementLevel: null,
    activatedAt: NOW,
    ...overrides,
  };
}

// ─── getAdminSellerList ───────────────────────────────────────────────────────

describe('getAdminSellerList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated sellers with correct fields', async () => {
    const rows = [makeSellerRow()];
    mockDbSelect.mockReturnValueOnce(makeCountChain(1));
    mockDbSelect.mockReturnValueOnce(makeChain(rows));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50 });

    expect(result.total).toBe(1);
    expect(result.sellers).toHaveLength(1);
    expect(result.sellers[0]!.userId).toBe('user-1');
  });

  it('filters by sellerType', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeChain([]));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50, sellerType: 'BUSINESS' });

    expect(result.sellers).toHaveLength(0);
  });

  it('filters by storeTier', async () => {
    const rows = [makeSellerRow({ storeTier: 'PRO' })];
    mockDbSelect.mockReturnValueOnce(makeCountChain(1));
    mockDbSelect.mockReturnValueOnce(makeChain(rows));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50, storeTier: 'PRO' });

    expect(result.sellers[0]!.storeTier).toBe('PRO');
  });

  it('filters by performanceBand', async () => {
    const rows = [makeSellerRow({ performanceBand: 'TOP_RATED' })];
    mockDbSelect.mockReturnValueOnce(makeCountChain(1));
    mockDbSelect.mockReturnValueOnce(makeChain(rows));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50, performanceBand: 'TOP_RATED' });

    expect(result.sellers[0]!.performanceBand).toBe('TOP_RATED');
  });

  it('filters by status', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeChain([]));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50, status: 'RESTRICTED' });

    expect(result.sellers).toHaveLength(0);
  });

  it('search matches name and email', async () => {
    const rows = [makeSellerRow()];
    mockDbSelect.mockReturnValueOnce(makeCountChain(1));
    mockDbSelect.mockReturnValueOnce(makeChain(rows));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50, search: 'jane' });

    expect(result.sellers).toHaveLength(1);
  });

  it('returns empty array when no matches', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(0));
    mockDbSelect.mockReturnValueOnce(makeChain([]));

    const { getAdminSellerList } = await import('../admin-sellers');
    const result = await getAdminSellerList({ page: 1, pageSize: 50, search: 'nobody' });

    expect(result.sellers).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getAdminVerificationQueue ────────────────────────────────────────────────

describe('getAdminVerificationQueue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns sellers with storeTier in PRO/POWER/ENTERPRISE and verifiedAt IS NULL', async () => {
    const rows = [makeQueueRow({ storeTier: 'PRO', verifiedAt: null })];
    const c: Record<string, unknown> = {};
    c['from'] = vi.fn().mockReturnValue(c);
    c['innerJoin'] = vi.fn().mockReturnValue(c);
    c['where'] = vi.fn().mockReturnValue(c);
    c['orderBy'] = vi.fn().mockResolvedValue(rows);
    mockDbSelect.mockReturnValue(c);

    const { getAdminVerificationQueue } = await import('../admin-sellers');
    const result = await getAdminVerificationQueue();

    expect(result).toHaveLength(1);
    expect(result[0]!.storeTier).toBe('PRO');
    expect(result[0]!.verifiedAt).toBeNull();
  });

  it('returns sellers with RESTRICTED status', async () => {
    const rows = [makeQueueRow({ status: 'RESTRICTED', storeTier: 'NONE' })];
    const c: Record<string, unknown> = {};
    c['from'] = vi.fn().mockReturnValue(c);
    c['innerJoin'] = vi.fn().mockReturnValue(c);
    c['where'] = vi.fn().mockReturnValue(c);
    c['orderBy'] = vi.fn().mockResolvedValue(rows);
    mockDbSelect.mockReturnValue(c);

    const { getAdminVerificationQueue } = await import('../admin-sellers');
    const result = await getAdminVerificationQueue();

    expect(result[0]!.status).toBe('RESTRICTED');
  });

  it('excludes verified sellers', async () => {
    const rows: unknown[] = [];
    const c: Record<string, unknown> = {};
    c['from'] = vi.fn().mockReturnValue(c);
    c['innerJoin'] = vi.fn().mockReturnValue(c);
    c['where'] = vi.fn().mockReturnValue(c);
    c['orderBy'] = vi.fn().mockResolvedValue(rows);
    mockDbSelect.mockReturnValue(c);

    const { getAdminVerificationQueue } = await import('../admin-sellers');
    const result = await getAdminVerificationQueue();

    expect(result).toHaveLength(0);
  });

  it('returns empty when no pending', async () => {
    const c: Record<string, unknown> = {};
    c['from'] = vi.fn().mockReturnValue(c);
    c['innerJoin'] = vi.fn().mockReturnValue(c);
    c['where'] = vi.fn().mockReturnValue(c);
    c['orderBy'] = vi.fn().mockResolvedValue([]);
    mockDbSelect.mockReturnValue(c);

    const { getAdminVerificationQueue } = await import('../admin-sellers');
    const result = await getAdminVerificationQueue();

    expect(result).toHaveLength(0);
  });
});
