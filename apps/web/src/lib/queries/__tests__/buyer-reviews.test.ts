import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBuyerReviews } from '../buyer-reviews';

// Mock dependencies
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

const { db } = await import('@/lib/db');
const mockDb = vi.mocked(db);

describe('getBuyerReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated reviews for user', async () => {
    // Mock count query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 2 }]),
      }),
    } as never);

    // Mock reviews query
    const mockReviews = [
      {
        id: 'rev1',
        orderId: 'ord1',
        rating: 5,
        title: 'Great item!',
        body: 'Very happy with purchase',
        dsrItemAsDescribed: 5,
        dsrShippingSpeed: 5,
        dsrCommunication: 5,
        dsrPackaging: 5,
        createdAt: new Date('2026-02-19'),
        status: 'APPROVED',
        sellerId: 'seller1',
        sellerName: 'John Doe',
        listingTitle: 'Vintage Camera',
        listingSlug: 'vintage-camera-123',
        responseId: null,
        responseBody: null,
        responseCreatedAt: null,
      },
      {
        id: 'rev2',
        orderId: 'ord2',
        rating: 4,
        title: null,
        body: 'Good',
        dsrItemAsDescribed: 4,
        dsrShippingSpeed: 4,
        dsrCommunication: 4,
        dsrPackaging: 4,
        createdAt: new Date('2026-02-18'),
        status: 'APPROVED',
        sellerId: 'seller2',
        sellerName: 'Jane Smith',
        listingTitle: 'Designer Bag',
        listingSlug: 'designer-bag-456',
        responseId: null,
        responseBody: null,
        responseCreatedAt: null,
      },
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockReviews),
      }),
    } as never);

    const result = await getBuyerReviews('user1');

    expect(result.reviews).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalCount: 2,
      totalPages: 1,
    });
  });

  it('returns empty list for user with no reviews', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);

    const result = await getBuyerReviews('user1');

    expect(result.reviews).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });

  it('canEdit is true within 48hr window', async () => {
    // Mock count query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    } as never);

    // Review created 12 hours ago (within 48hr window)
    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 12);

    const mockReviews = [
      {
        id: 'rev1',
        orderId: 'ord1',
        rating: 5,
        title: 'Great',
        body: 'Awesome',
        dsrItemAsDescribed: 5,
        dsrShippingSpeed: 5,
        dsrCommunication: 5,
        dsrPackaging: 5,
        createdAt: recentDate,
        status: 'APPROVED',
        sellerId: 'seller1',
        sellerName: 'John Doe',
        listingTitle: 'Item',
        listingSlug: 'item-123',
        responseId: null,
        responseBody: null,
        responseCreatedAt: null,
      },
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockReviews),
      }),
    } as never);

    const result = await getBuyerReviews('user1');

    expect(result.reviews[0]?.canEdit).toBe(true);
    // 48h window - 12h elapsed = 36h remaining (Math.ceil may give 35 or 36 due to sub-second timing)
    expect(result.reviews[0]?.hoursUntilEditExpires).toBeGreaterThanOrEqual(35);
    expect(result.reviews[0]?.hoursUntilEditExpires).toBeLessThanOrEqual(36);
  });

  it('canEdit is false after 48hr window', async () => {
    // Mock count query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    } as never);

    // Review created 49 hours ago (past 48hr window)
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 49);

    const mockReviews = [
      {
        id: 'rev1',
        orderId: 'ord1',
        rating: 5,
        title: 'Great',
        body: 'Awesome',
        dsrItemAsDescribed: 5,
        dsrShippingSpeed: 5,
        dsrCommunication: 5,
        dsrPackaging: 5,
        createdAt: oldDate,
        status: 'APPROVED',
        sellerId: 'seller1',
        sellerName: 'John Doe',
        listingTitle: 'Item',
        listingSlug: 'item-123',
        responseId: null,
        responseBody: null,
        responseCreatedAt: null,
      },
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockReviews),
      }),
    } as never);

    const result = await getBuyerReviews('user1');

    expect(result.reviews[0]?.canEdit).toBe(false);
    expect(result.reviews[0]?.hoursUntilEditExpires).toBeNull();
  });

  it('includes seller response when exists', async () => {
    // Mock count query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 1 }]),
      }),
    } as never);

    const mockReviews = [
      {
        id: 'rev1',
        orderId: 'ord1',
        rating: 5,
        title: 'Great',
        body: 'Awesome',
        dsrItemAsDescribed: 5,
        dsrShippingSpeed: 5,
        dsrCommunication: 5,
        dsrPackaging: 5,
        createdAt: new Date('2026-02-10'),
        status: 'APPROVED',
        sellerId: 'seller1',
        sellerName: 'John Doe',
        listingTitle: 'Item',
        listingSlug: 'item-123',
        responseId: 'resp1',
        responseBody: 'Thank you for your feedback!',
        responseCreatedAt: new Date('2026-02-11'),
      },
    ];

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockReviews),
      }),
    } as never);

    const result = await getBuyerReviews('user1');

    expect(result.reviews[0]?.response).toEqual({
      body: 'Thank you for your feedback!',
      createdAt: new Date('2026-02-11'),
    });
  });

  it('excludes reviews from other users', async () => {
    // Mock count query - user has no reviews
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as never);

    const result = await getBuyerReviews('user2');

    expect(result.reviews).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
  });
});
