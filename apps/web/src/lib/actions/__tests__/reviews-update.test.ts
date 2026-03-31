import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/commerce/review-visibility', () => ({
  updateReviewVisibility: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { updateReview } from '../reviews';
import { getReviewForOrder } from '../../queries/review-for-order';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// Get mocked functions after imports
const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

const validReviewData = {
  rating: 5,
  title: 'Great product!',
  body: 'Really happy with this purchase.',
  photos: [] as string[],
  dsrItemAsDescribed: 5,
  dsrShippingSpeed: 4,
  dsrCommunication: 5,
  dsrPackaging: 4,
};

describe('updateReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await updateReview('review1', validReviewData);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error if edit window closed (48 hours)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 49); // 49 hours ago (beyond 48-hour window)

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // First call: fetch review
              return Promise.resolve([{
                id: 'review1',
                reviewerUserId: 'user1',
                orderId: 'order1',
                sellerId: 'seller1',
                createdAt: oldDate,
              }]);
            } else {
              // Aggregate query for seller performance
              return Promise.resolve([{ count: 1, avgRating: 5.0 }]);
            }
          }),
        }),
      }),
    }) as never);

    const result = await updateReview('review1', validReviewData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Edit window closed');
  });

  it('updates review within 48-hour window', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 1); // 1 hour ago (within 48-hour window)

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          const queryChain = {
            limit: vi.fn().mockImplementation(() => {
              if (selectCallCount === 1) {
                // First call: fetch review
                return Promise.resolve([{
                  id: 'review1',
                  reviewerUserId: 'user1',
                  orderId: 'order1',
                  sellerId: 'seller1',
                  createdAt: recentDate,
                }]);
              } else {
                // Second call: fetch sellerProfileId
                return Promise.resolve([{ id: 'profile1' }]);
              }
            }),
            // Aggregate query doesn't use limit, resolves directly
            then: (resolve: (value: unknown) => void) => {
              resolve([{ count: 1, avgRating: 5.0 }]);
              return Promise.resolve([{ count: 1, avgRating: 5.0 }]);
            },
          };
          return queryChain;
        }),
      }),
    }) as never);

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const result = await updateReview('review1', validReviewData);

    expect(result).toEqual({ success: true, reviewId: 'review1' });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('getReviewForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('returns review with canEdit=true within 48-hour window', async () => {
    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 1); // 1 hour ago

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'review1',
            reviewerUserId: 'user1',
            rating: 5,
            title: 'Great!',
            body: 'Loved it',
            photos: [],
            dsrItemAsDescribed: 5,
            dsrShippingSpeed: 4,
            dsrCommunication: 5,
            dsrPackaging: 4,
            createdAt: recentDate,
          }]),
        }),
      }),
    } as never);

    const result = await getReviewForOrder('order1', 'user1');

    expect(result.success).toBe(true);
    expect(result.review?.canEdit).toBe(true);
  });

  it('returns review with canEdit=false after 48-hour window', async () => {
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 49); // 49 hours ago (beyond 48-hour window)

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'review1',
            reviewerUserId: 'user1',
            rating: 5,
            title: 'Great!',
            body: 'Loved it',
            photos: [],
            dsrItemAsDescribed: 5,
            dsrShippingSpeed: 4,
            dsrCommunication: 5,
            dsrPackaging: 4,
            createdAt: oldDate,
          }]),
        }),
      }),
    } as never);

    const result = await getReviewForOrder('order1', 'user1');

    expect(result.success).toBe(true);
    expect(result.review?.canEdit).toBe(false);
  });
});
