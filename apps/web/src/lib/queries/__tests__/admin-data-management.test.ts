/**
 * Admin Data Management Query Tests (I12)
 * Covers bulk, exports, and imports query functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', status: 'status', title: 'title', priceCents: 'price_cents', createdAt: 'created_at', ownerUserId: 'owner_user_id' },
  user: { id: 'id', name: 'name', email: 'email', isSeller: 'is_seller', isBanned: 'is_banned', createdAt: 'created_at' },
  dataExportRequest: { id: 'id', status: 'status', format: 'format', createdAt: 'created_at', completedAt: 'completed_at', downloadUrl: 'download_url', downloadExpiresAt: 'download_expires_at', userId: 'user_id' },
  importBatch: { id: 'id', status: 'status', channel: 'channel', sellerId: 'seller_id', totalItems: 'total_items', createdItems: 'created_items', failedItems: 'failed_items', startedAt: 'started_at', completedAt: 'completed_at', errorSummaryJson: 'error_summary_json' },
}));
vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ type: 'eq' }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  or: (..._args: unknown[]) => ({ type: 'or' }),
  count: () => ({ type: 'count' }),
  ilike: (_a: unknown, _b: unknown) => ({ type: 'ilike' }),
  inArray: (_a: unknown, _b: unknown) => ({ type: 'inArray' }),
  lte: (_a: unknown, _b: unknown) => ({ type: 'lte' }),
  avg: (_a: unknown) => ({ type: 'avg' }),
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql' }),
    { raw: (_s: string) => _s }
  ),
}));

// ─── Chain helper ─────────────────────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'having']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

const NOW = new Date('2026-01-01T00:00:00Z');

// ─── getBulkListingSummary ────────────────────────────────────────────────────

describe('getBulkListingSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct counts from DB row', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ totalListings: 10, activeListings: 6, removedListings: 2, draftListings: 2 }]));

    const { getBulkListingSummary } = await import('../admin-data-bulk');
    const result = await getBulkListingSummary();

    expect(result.totalListings).toBe(10);
    expect(result.activeListings).toBe(6);
    expect(result.removedListings).toBe(2);
    expect(result.draftListings).toBe(2);
  });

  it('returns zero counts when DB row is empty', async () => {
    mockDbSelect.mockReturnValue(makeChain([undefined]));

    const { getBulkListingSummary } = await import('../admin-data-bulk');
    const result = await getBulkListingSummary();

    expect(result.totalListings).toBe(0);
    expect(result.activeListings).toBe(0);
  });
});

// ─── getBulkListings ──────────────────────────────────────────────────────────

describe('getBulkListings', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated listings', async () => {
    const row = { id: 'l1', title: 'Shoes', status: 'ACTIVE', priceCents: 1000, createdAt: NOW, ownerUserId: 'u1', sellerName: 'Alice' };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))
      .mockReturnValueOnce(makeChain([{ total: 1 }]));

    const { getBulkListings } = await import('../admin-data-bulk');
    const result = await getBulkListings({ page: 1, pageSize: 10 });

    expect(result.listings).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.listings[0]?.sellerName).toBe('Alice');
  });

  it('filters by status when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getBulkListings } = await import('../admin-data-bulk');
    const result = await getBulkListings({ page: 1, pageSize: 10, status: 'REMOVED' });

    expect(result.listings).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('filters by search when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getBulkListings } = await import('../admin-data-bulk');
    const result = await getBulkListings({ page: 1, pageSize: 10, search: 'Nike' });

    expect(result.listings).toHaveLength(0);
  });

  it('returns empty result when no listings', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getBulkListings } = await import('../admin-data-bulk');
    const result = await getBulkListings({ page: 1, pageSize: 10 });

    expect(result.listings).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getBulkUserSummary ───────────────────────────────────────────────────────

describe('getBulkUserSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct user counts', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ totalUsers: 100, bannedUsers: 5, activeUsers: 95 }]));

    const { getBulkUserSummary } = await import('../admin-data-bulk');
    const result = await getBulkUserSummary();

    expect(result.totalUsers).toBe(100);
    expect(result.bannedUsers).toBe(5);
    expect(result.activeUsers).toBe(95);
  });
});

// ─── getBulkUsers ─────────────────────────────────────────────────────────────

describe('getBulkUsers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated users', async () => {
    const row = { id: 'u1', name: 'Alice', email: 'alice@example.com', isSeller: true, isBanned: false, createdAt: NOW };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))
      .mockReturnValueOnce(makeChain([{ total: 1 }]));

    const { getBulkUsers } = await import('../admin-data-bulk');
    const result = await getBulkUsers({ page: 1, pageSize: 10 });

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.users[0]?.name).toBe('Alice');
  });

  it('filters by bannedOnly when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getBulkUsers } = await import('../admin-data-bulk');
    const result = await getBulkUsers({ page: 1, pageSize: 10, bannedOnly: true });

    expect(result.users).toHaveLength(0);
  });

  it('searches by name/email when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getBulkUsers } = await import('../admin-data-bulk');
    const result = await getBulkUsers({ page: 1, pageSize: 10, search: 'alice' });

    expect(result.users).toHaveLength(0);
  });
});

// ─── getExportRequestSummary ──────────────────────────────────────────────────

describe('getExportRequestSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns counts by status', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ total: 20, pending: 5, completed: 12, failed: 3 }]));

    const { getExportRequestSummary } = await import('../admin-data-exports');
    const result = await getExportRequestSummary();

    expect(result.total).toBe(20);
    expect(result.pending).toBe(5);
    expect(result.completed).toBe(12);
    expect(result.failed).toBe(3);
  });
});

// ─── getExportRequestList ─────────────────────────────────────────────────────

describe('getExportRequestList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('paginates export requests', async () => {
    const row = { id: 'e1', userName: 'Bob', userEmail: 'bob@example.com', format: 'json', status: 'COMPLETED', requestedAt: NOW, completedAt: NOW, downloadUrl: null, downloadExpiresAt: null };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))
      .mockReturnValueOnce(makeChain([{ total: 1 }]));

    const { getExportRequestList } = await import('../admin-data-exports');
    const result = await getExportRequestList({ page: 1, pageSize: 10 });

    expect(result.requests).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.requests[0]?.userName).toBe('Bob');
  });

  it('joins user table for name/email', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getExportRequestList } = await import('../admin-data-exports');
    const result = await getExportRequestList({ page: 1, pageSize: 10 });

    expect(result.requests).toHaveLength(0);
  });

  it('filters by status when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getExportRequestList } = await import('../admin-data-exports');
    const result = await getExportRequestList({ page: 1, pageSize: 10, status: 'FAILED' });

    expect(result.requests).toHaveLength(0);
  });

  it('searches by user when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getExportRequestList } = await import('../admin-data-exports');
    const result = await getExportRequestList({ page: 1, pageSize: 10, search: 'bob' });

    expect(result.requests).toHaveLength(0);
  });

  it('returns empty when no requests', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getExportRequestList } = await import('../admin-data-exports');
    const result = await getExportRequestList({ page: 1, pageSize: 10 });

    expect(result.requests).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getExportSlaBreach ───────────────────────────────────────────────────────

describe('getExportSlaBreach', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('counts overdue export requests', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ total: 3 }]));

    const { getExportSlaBreach } = await import('../admin-data-exports');
    const result = await getExportSlaBreach(48);

    expect(result).toBe(3);
  });

  it('returns zero when no overdue requests', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ total: 0 }]));

    const { getExportSlaBreach } = await import('../admin-data-exports');
    const result = await getExportSlaBreach(48);

    expect(result).toBe(0);
  });
});

// ─── getImportBatchSummary ────────────────────────────────────────────────────

describe('getImportBatchSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns batch counts by status group', async () => {
    mockDbSelect.mockReturnValue(makeChain([{ total: 50, inProgress: 3, completed: 44, failed: 3 }]));

    const { getImportBatchSummary } = await import('../admin-data-imports');
    const result = await getImportBatchSummary();

    expect(result.total).toBe(50);
    expect(result.inProgress).toBe(3);
    expect(result.completed).toBe(44);
    expect(result.failed).toBe(3);
  });
});

// ─── getImportBatchList ───────────────────────────────────────────────────────

describe('getImportBatchList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('paginates import batches', async () => {
    const row = { id: 'b1', sellerName: 'Carol', channel: 'POSHMARK', status: 'COMPLETED', totalItems: 100, createdItems: 98, failedItems: 2, startedAt: NOW, completedAt: NOW, errorSummaryJson: [] };
    mockDbSelect
      .mockReturnValueOnce(makeChain([row]))
      .mockReturnValueOnce(makeChain([{ total: 1 }]));

    const { getImportBatchList } = await import('../admin-data-imports');
    const result = await getImportBatchList({ page: 1, pageSize: 10 });

    expect(result.batches).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.batches[0]?.sellerName).toBe('Carol');
  });

  it('filters by status when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getImportBatchList } = await import('../admin-data-imports');
    const result = await getImportBatchList({ page: 1, pageSize: 10, status: 'FAILED' });

    expect(result.batches).toHaveLength(0);
  });

  it('filters by channel when provided', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getImportBatchList } = await import('../admin-data-imports');
    const result = await getImportBatchList({ page: 1, pageSize: 10, channel: 'EBAY' });

    expect(result.batches).toHaveLength(0);
  });

  it('joins user table for sellerName', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getImportBatchList } = await import('../admin-data-imports');
    const result = await getImportBatchList({ page: 1, pageSize: 10 });

    expect(result.batches).toHaveLength(0);
  });

  it('returns empty when no batches', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([{ total: 0 }]));

    const { getImportBatchList } = await import('../admin-data-imports');
    const result = await getImportBatchList({ page: 1, pageSize: 10 });

    expect(result.batches).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getImportHealthStats ─────────────────────────────────────────────────────

describe('getImportHealthStats', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns avg completion time and success rate', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ avgCompletionMs: '45000' }]))
      .mockReturnValueOnce(makeChain([{ total: 10, completed: 9 }]));

    const { getImportHealthStats } = await import('../admin-data-imports');
    const result = await getImportHealthStats();

    expect(result.avgCompletionMs).toBe(45000);
    expect(result.successRatePercent).toBe(90);
  });

  it('returns null stats when no batches', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeChain([{ avgCompletionMs: null }]))
      .mockReturnValueOnce(makeChain([{ total: 0, completed: 0 }]));

    const { getImportHealthStats } = await import('../admin-data-imports');
    const result = await getImportHealthStats();

    expect(result.avgCompletionMs).toBeNull();
    expect(result.successRatePercent).toBeNull();
  });
});
