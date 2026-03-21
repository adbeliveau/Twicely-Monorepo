import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();

function makeChain(finalResult: unknown[] = []) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(finalResult).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  ne: vi.fn((col, val) => ({ type: 'ne', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  or: vi.fn((...args) => ({ type: 'or', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
  count: vi.fn(() => ({ type: 'count' })),
  avg: vi.fn((expr) => ({ type: 'avg', expr })),
  gte: vi.fn((col, val) => ({ type: 'gte', col, val })),
  sql: Object.assign(vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values })), {
    append: vi.fn(),
  }),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', ownerUserId: 'owner_user_id', enforcementState: 'enforcement_state', title: 'title', priceCents: 'price_cents', createdAt: 'created_at', updatedAt: 'updated_at', status: 'status', description: 'description', condition: 'condition', tags: 'tags', activatedAt: 'activated_at', categoryId: 'category_id' },
  review: { id: 'id', status: 'status', body: 'body', rating: 'rating', reviewerUserId: 'reviewer_user_id', sellerId: 'seller_id', createdAt: 'created_at', title: 'title', photos: 'photos', isVerifiedPurchase: 'is_verified_purchase', flagReason: 'flag_reason', flaggedByUserId: 'flagged_by_user_id', removedByStaffId: 'removed_by_staff_id', removedReason: 'removed_reason', dsrItemAsDescribed: 'dsr_item_as_described', dsrShippingSpeed: 'dsr_shipping_speed', dsrCommunication: 'dsr_communication', dsrPackaging: 'dsr_packaging', orderId: 'order_id' },
  user: { id: 'id', name: 'name' },
  contentReport: { id: 'id', status: 'status', targetType: 'target_type', targetId: 'target_id', reason: 'reason', createdAt: 'created_at', reporterUserId: 'reporter_user_id', reviewedAt: 'reviewed_at' },
  enforcementAction: { id: 'id', userId: 'user_id', status: 'status', actionType: 'action_type', createdAt: 'created_at' },
  listingImage: { id: 'id', listingId: 'listing_id', url: 'url', position: 'position' },
  sellerProfile: { id: 'id', userId: 'user_id', performanceBand: 'performance_band' },
  sellerPerformance: { id: 'id', sellerProfileId: 'seller_profile_id', averageRating: 'average_rating', totalReviews: 'total_reviews' },
  reviewResponse: { id: 'id', reviewId: 'review_id', body: 'body', createdAt: 'created_at' },
  category: { id: 'id', name: 'name' },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getModeratedListings', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns listings filtered by enforcementState', async () => {
    const countChain = makeChain([{ count: 2 }]);
    const rowChain = makeChain([
      { id: 'lst-1', title: 'Item', ownerUserId: 'u1', priceCents: 1000, enforcementState: 'FLAGGED', createdAt: new Date() },
    ]);
    const ownerChain = makeChain([{ id: 'u1', name: 'John' }]);
    mockSelect.mockReturnValueOnce(countChain).mockReturnValueOnce(rowChain).mockReturnValueOnce(ownerChain);

    const { getModeratedListings } = await import('../admin-moderation');
    const result = await getModeratedListings('FLAGGED', 1, 50);

    expect(result.total).toBe(2);
    expect(result.listings[0]).toMatchObject({ id: 'lst-1', sellerName: 'John' });
  });

  it('returns all non-CLEAR when filter is null', async () => {
    const countChain = makeChain([{ count: 5 }]);
    const rowChain = makeChain([]);
    const ownerChain = makeChain([]);
    mockSelect.mockReturnValueOnce(countChain).mockReturnValueOnce(rowChain).mockReturnValueOnce(ownerChain);

    const { getModeratedListings } = await import('../admin-moderation');
    const result = await getModeratedListings(null, 1, 50);

    expect(result.total).toBe(5);
  });
});

describe('getModerationStats', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns reportsToday count and avgResolutionHours', async () => {
    const todayChain = makeChain([{ count: 7 }]);
    const avgChain = makeChain([{ avg: '2.5' }]);
    mockSelect.mockReturnValueOnce(todayChain).mockReturnValueOnce(avgChain);

    const { getModerationStats } = await import('../admin-moderation');
    const result = await getModerationStats();

    expect(result.reportsToday).toBe(7);
    expect(result.avgResolutionHours).toBe(2.5);
  });
});

describe('getSuppressedListings', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns only SUPPRESSED listings', async () => {
    const countChain = makeChain([{ count: 1 }]);
    const rowChain = makeChain([
      { id: 'lst-s', title: 'Suppressed', ownerUserId: 'u2', priceCents: 500, updatedAt: new Date() },
    ]);
    const ownerChain = makeChain([{ id: 'u2', name: 'Jane' }]);
    mockSelect.mockReturnValueOnce(countChain).mockReturnValueOnce(rowChain).mockReturnValueOnce(ownerChain);

    const { getSuppressedListings } = await import('../admin-moderation');
    const result = await getSuppressedListings(1, 50);

    expect(result.total).toBe(1);
    expect(result.listings[0]).toMatchObject({ id: 'lst-s', sellerName: 'Jane' });
  });
});

describe('getPendingFirstReviewListings', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns flagged listings with no content reports', async () => {
    const flaggedChain = makeChain([
      { id: 'lst-pend', title: 'Pending', ownerUserId: 'u3', priceCents: 999, createdAt: new Date() },
    ]);
    // Content reports query returns empty (no reports)
    const reportedChain = makeChain([]);
    const ownerChain = makeChain([{ id: 'u3', name: 'Sam' }]);
    mockSelect.mockReturnValueOnce(flaggedChain).mockReturnValueOnce(reportedChain).mockReturnValueOnce(ownerChain);

    const { getPendingFirstReviewListings } = await import('../admin-moderation');
    const result = await getPendingFirstReviewListings(1, 50);

    expect(result.total).toBe(1);
    expect(result.listings[0]).toMatchObject({ id: 'lst-pend', sellerName: 'Sam' });
  });
});

describe('getListingForModeration', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns null for non-existent listing', async () => {
    const chain = makeChain([]);
    mockSelect.mockReturnValue(chain);

    const { getListingForModeration } = await import('../admin-moderation');
    const result = await getListingForModeration('nonexistent');
    expect(result).toBeNull();
  });

  it('returns full listing with images and seller info', async () => {
    const listingRow = {
      id: 'lst-full', title: 'Full listing', description: 'desc', priceCents: 2000,
      condition: 'GOOD', enforcementState: 'FLAGGED', status: 'ACTIVE', tags: ['tag1'],
      createdAt: new Date(), activatedAt: null, ownerUserId: 'u10', categoryId: 'cat-1',
    };
    const listingChain = makeChain([listingRow]);
    const ownerChain = makeChain([{ id: 'u10', name: 'Alice' }]);
    const imageChain = makeChain([{ url: 'https://img.example.com/1.jpg', position: 0 }]);
    const catChain = makeChain([{ name: 'Electronics' }]);
    const spChain = makeChain([{ performanceBand: 'ESTABLISHED', sellerProfileId: 'sp-1' }]);
    const perfChain = makeChain([{ averageRating: 4.5, totalReviews: 10 }]);
    const enfChain = makeChain([{ count: 0 }]);

    mockSelect.mockReturnValueOnce(listingChain)
      .mockReturnValueOnce(ownerChain)
      .mockReturnValueOnce(imageChain)
      .mockReturnValueOnce(catChain)
      .mockReturnValueOnce(spChain)
      .mockReturnValueOnce(perfChain)
      .mockReturnValueOnce(enfChain);

    const { getListingForModeration } = await import('../admin-moderation');
    const result = await getListingForModeration('lst-full');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Full listing');
    expect(result?.sellerName).toBe('Alice');
  });
});

describe('getModerationQueue', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns items from all three sources in priority order', async () => {
    const reportChain = makeChain([
      { id: 'r1', targetId: 't1', targetType: 'LISTING', reason: 'SPAM', status: 'PENDING', createdAt: new Date(2024, 0, 1) },
    ]);
    const listingChain = makeChain([
      { id: 'lst-q', title: 'Queued listing', createdAt: new Date(2024, 0, 2) },
    ]);
    const reviewChain = makeChain([
      { id: 'rev-q', body: 'Queued review', createdAt: new Date(2024, 0, 3) },
    ]);

    mockSelect.mockReturnValueOnce(reportChain)
      .mockReturnValueOnce(listingChain)
      .mockReturnValueOnce(reviewChain);

    const { getModerationQueue } = await import('../admin-moderation');
    const result = await getModerationQueue(1, 50);

    expect(result.total).toBe(3);
    expect(result.items[0]?.type).toBe('Report');
    expect(result.items[1]?.type).toBe('Listing');
    expect(result.items[2]?.type).toBe('Review');
  });
});

describe('getReviewForModeration', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns null for non-existent review', async () => {
    const chain = makeChain([]);
    mockSelect.mockReturnValue(chain);

    const { getReviewForModeration } = await import('../admin-moderation');
    const result = await getReviewForModeration('nonexistent');
    expect(result).toBeNull();
  });

  it('returns review with context (buyer, seller, response)', async () => {
    const reviewRow = {
      id: 'rev-full', orderId: 'ord-1', reviewerUserId: 'buyer-1', sellerId: 'seller-1',
      rating: 5, title: 'Great!', body: 'Excellent product', photos: [],
      status: 'FLAGGED', isVerifiedPurchase: true, flagReason: 'spam',
      flaggedByUserId: 'u-rep', removedByStaffId: null, removedReason: null,
      dsrItemAsDescribed: null, dsrShippingSpeed: null, dsrCommunication: null, dsrPackaging: null,
      createdAt: new Date(),
    };
    const revChain = makeChain([reviewRow]);
    const buyerChain = makeChain([{ id: 'buyer-1', name: 'Buyer' }]);
    const sellerChain = makeChain([{ id: 'seller-1', name: 'Seller' }]);
    const respChain = makeChain([{ body: 'Thank you!', createdAt: new Date() }]);

    mockSelect.mockReturnValueOnce(revChain)
      .mockReturnValueOnce(buyerChain)
      .mockReturnValueOnce(sellerChain)
      .mockReturnValueOnce(respChain);

    const { getReviewForModeration } = await import('../admin-moderation');
    const result = await getReviewForModeration('rev-full');

    expect(result).not.toBeNull();
    expect(result?.reviewerName).toBe('Buyer');
    expect(result?.sellerName).toBe('Seller');
    expect(result?.sellerResponse).toMatchObject({ body: 'Thank you!' });
  });
});

describe('getModeratedReviews', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('filters by FLAGGED status by default', async () => {
    const countChain = makeChain([{ count: 2 }]);
    const rowChain = makeChain([
      { id: 'r1', rating: 3, comment: 'meh', reviewerId: 'u1', sellerId: 'u2', status: 'FLAGGED', createdAt: new Date() },
    ]);
    mockSelect.mockReturnValueOnce(countChain).mockReturnValueOnce(rowChain);

    const { getModeratedReviews } = await import('../admin-moderation');
    const result = await getModeratedReviews(null, null, null, 1, 50);
    expect(result.total).toBe(2);
  });

  it('filters by rating', async () => {
    const countChain = makeChain([{ count: 1 }]);
    const rowChain = makeChain([
      { id: 'r2', rating: 1, comment: 'bad', reviewerId: 'u1', sellerId: 'u2', status: 'FLAGGED', createdAt: new Date() },
    ]);
    mockSelect.mockReturnValueOnce(countChain).mockReturnValueOnce(rowChain);

    const { getModeratedReviews } = await import('../admin-moderation');
    const result = await getModeratedReviews(1, null, null, 1, 50);
    expect(result.total).toBe(1);
  });
});

describe('getMessageFlagPatterns', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('returns top 5 reasons for MESSAGE reports in last 30 days', async () => {
    const chain = makeChain([
      { reason: 'HARASSMENT', count: 8 },
      { reason: 'SPAM', count: 5 },
      { reason: 'FEE_AVOIDANCE', count: 3 },
    ]);
    mockSelect.mockReturnValue(chain);

    const { getMessageFlagPatterns } = await import('../admin-moderation');
    const result = await getMessageFlagPatterns();

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ reason: 'HARASSMENT', count: 8 });
  });
});
