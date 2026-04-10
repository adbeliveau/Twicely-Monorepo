/**
 * Search Full Reindex Job Tests — Phase 4 (Decision #143)
 * Validates end-to-end reindex flow: PG stream → batch → engine upsert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (accessible in vi.mock factories) ──────────────────────────

const { mockGetPlatformSetting, mockInsert, mockUpdate, mockSelect, mockQueueAdd,
  mockCreateVersionedIndex, mockSwapWriteAlias, mockSwapReadAlias,
  mockBulkUpsert, mockBulkUpsertListings } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([]),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
      leftJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  });

  return {
    mockGetPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) =>
      Promise.resolve(fallback ?? 500),
    ),
    mockInsert,
    mockUpdate,
    mockSelect,
    mockQueueAdd: vi.fn().mockResolvedValue({ id: 'job-1' }),
    mockCreateVersionedIndex: vi.fn().mockResolvedValue('twicely_listings_v1_20260410'),
    mockSwapWriteAlias: vi.fn().mockResolvedValue(undefined),
    mockSwapReadAlias: vi.fn().mockResolvedValue(undefined),
    mockBulkUpsert: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
    mockBulkUpsertListings: vi.fn().mockResolvedValue({ success: 0, failed: 0 }),
  };
});

// ─── vi.mock declarations ──────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status', title: 'title', description: 'description', brand: 'brand', tags: 'tags', categoryId: 'category_id', storefrontCategoryId: 'storefront_category_id', condition: 'condition', fulfillmentType: 'fulfillment_type', authenticationStatus: 'authentication_status', freeShipping: 'free_shipping', priceCents: 'price_cents', originalPriceCents: 'original_price_cents', shippingCents: 'shipping_cents', availableQuantity: 'available_quantity', boostPercent: 'boost_percent', activatedAt: 'activated_at', createdAt: 'created_at', slug: 'slug', dealBadgeType: 'deal_badge_type', soldAt: 'sold_at' },
  listingImage: { listingId: 'listing_id', url: 'url', altText: 'alt_text', isPrimary: 'is_primary' },
  user: { id: 'id', name: 'name', username: 'username', avatarUrl: 'avatar_url' },
  sellerProfile: { id: 'id', userId: 'user_id' },
  sellerPerformance: { sellerProfileId: 'seller_profile_id', currentScore: 'current_score', performanceBand: 'performance_band', totalReviews: 'total_reviews', averageRating: 'average_rating', showStars: 'show_stars' },
  category: { id: 'id', name: 'name', slug: 'slug', parentId: 'parent_id' },
  searchIndexJob: { id: 'id', jobType: 'job_type', domain: 'domain', status: 'status', totalItems: 'total_items', succeededItems: 'succeeded_items', failedItems: 'failed_items', triggeredByStaffId: 'triggered_by_staff_id', startedAt: 'started_at', completedAt: 'completed_at', errorSummary: 'error_summary' },
  searchIndexVersion: { id: 'id', domain: 'domain', physicalIndexName: 'physical_index_name', mappingVersion: 'mapping_version', docCount: 'doc_count', status: 'status', isReadActive: 'is_read_active', isWriteActive: 'is_write_active', updatedAt: 'updated_at' },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn().mockReturnValue('test-cuid-1'),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('@twicely/search/opensearch-lifecycle', () => ({
  createVersionedIndex: (...args: unknown[]) => mockCreateVersionedIndex(...args),
  swapWriteAlias: (...args: unknown[]) => mockSwapWriteAlias(...args),
  swapReadAlias: (...args: unknown[]) => mockSwapReadAlias(...args),
}));

vi.mock('@twicely/search/opensearch-index', () => ({
  bulkUpsert: (...args: unknown[]) => mockBulkUpsert(...args),
}));

vi.mock('@twicely/search/typesense-index', () => ({
  bulkUpsertListings: (...args: unknown[]) => mockBulkUpsertListings(...args),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runFullReindex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: opensearch engine, 0 active listings
    mockGetPlatformSetting.mockImplementation(
      (key: string, fallback?: unknown) => {
        if (key === 'search.engine') return Promise.resolve('opensearch');
        return Promise.resolve(fallback ?? 500);
      },
    );
  });

  it('creates a searchIndexJob record', async () => {
    const { runFullReindex } = await import('../search-full-reindex');

    await runFullReindex('staff-1');

    expect(mockInsert).toHaveBeenCalled();
  });

  it('calls createVersionedIndex for opensearch engine', async () => {
    const { runFullReindex } = await import('../search-full-reindex');

    await runFullReindex('staff-1', 2);

    expect(mockCreateVersionedIndex).toHaveBeenCalledWith(2);
  });

  it('swaps write alias before backfill, then read alias after', async () => {
    const { runFullReindex } = await import('../search-full-reindex');

    await runFullReindex();

    expect(mockSwapWriteAlias).toHaveBeenCalledWith('twicely_listings_v1_20260410');
    expect(mockSwapReadAlias).toHaveBeenCalledWith('twicely_listings_v1_20260410');

    // Write alias swap happens before read alias swap
    const writeOrder = mockSwapWriteAlias.mock.invocationCallOrder[0];
    const readOrder = mockSwapReadAlias.mock.invocationCallOrder[0];
    expect(writeOrder).toBeLessThan(readOrder);
  });

  it('returns result with jobId, indexName, and counts', async () => {
    const { runFullReindex } = await import('../search-full-reindex');

    const result = await runFullReindex('staff-1');

    expect(result).toMatchObject({
      jobId: 'test-cuid-1',
      indexName: 'twicely_listings_v1_20260410',
      totalItems: 0,
      succeededItems: 0,
      failedItems: 0,
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('uses typesense bulkUpsertListings when engine is typesense', async () => {
    mockGetPlatformSetting.mockImplementation(
      (key: string, fallback?: unknown) => {
        if (key === 'search.engine') return Promise.resolve('typesense');
        return Promise.resolve(fallback ?? 500);
      },
    );

    const { runFullReindex } = await import('../search-full-reindex');
    await runFullReindex();

    // OpenSearch should NOT be called
    expect(mockCreateVersionedIndex).not.toHaveBeenCalled();
    expect(mockSwapWriteAlias).not.toHaveBeenCalled();
    expect(mockSwapReadAlias).not.toHaveBeenCalled();
  });

  it('marks job as FAILED on error', async () => {
    mockCreateVersionedIndex.mockRejectedValueOnce(new Error('OpenSearch down'));

    const { runFullReindex } = await import('../search-full-reindex');

    await expect(runFullReindex()).rejects.toThrow('OpenSearch down');

    // Should have called update to set status=FAILED
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('enqueueFullReindex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a full-reindex job to the queue', async () => {
    const { enqueueFullReindex } = await import('../search-full-reindex');

    await enqueueFullReindex('staff-admin-1', 3);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'full-reindex',
      { triggeredByStaffId: 'staff-admin-1', mappingVersion: 3 },
      expect.objectContaining({ jobId: expect.stringContaining('full-reindex-') }),
    );
  });
});
