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

vi.mock('@twicely/commerce/seller-performance', () => ({
  updateSellerPerformanceAggregates: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { submitReview } from '../reviews';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { updateSellerPerformanceAggregates } from '@twicely/commerce/seller-performance';
import { updateReviewVisibility } from '@twicely/commerce/review-visibility';

// Get mocked functions after imports
const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockUpdateSellerPerformance = vi.mocked(updateSellerPerformanceAggregates);
const mockUpdateReviewVisibility = vi.mocked(updateReviewVisibility);

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

describe('submitReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('returns error if not authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn() } as never,
    });

    const result = await submitReview('order1', validReviewData);
    expect(result).toEqual({ success: false, error: 'Please sign in to leave a review' });
  });

  it('returns error if user cannot create reviews', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(false) } as never,
    });

    const result = await submitReview('order1', validReviewData);

    expect(result).toEqual({ success: false, error: 'Your account cannot create reviews' });
  });

  it('returns validation errors for invalid rating', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const result = await submitReview('order1', { ...validReviewData, rating: 6 });

    expect(result.success).toBe(false);
    expect(result.errors?.rating).toBeTruthy();
  });

  it('returns error if order not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const result = await submitReview('order1', validReviewData);

    expect(result).toEqual({ success: false, error: 'Order not found' });
  });

  it('returns error if user does not own the order', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'order1',
            buyerId: 'user2',
            sellerId: 'seller1',
            status: 'COMPLETED',
            completedAt: new Date(),
            deliveredAt: null,
            totalCents: 5000,
          }]),
        }),
      }),
    } as never);

    const result = await submitReview('order1', validReviewData);

    expect(result).toEqual({ success: false, error: 'You can only review orders you purchased' });
  });

  it('returns error if order not COMPLETED or DELIVERED', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'order1',
            buyerId: 'user1',
            sellerId: 'seller1',
            status: 'PAID',
            completedAt: null,
            deliveredAt: null,
            totalCents: 5000,
          }]),
        }),
      }),
    } as never);

    const result = await submitReview('order1', validReviewData);

    expect(result).toEqual({ success: false, error: 'You can only review completed or delivered orders' });
  });

  it('returns error if review window closed (60 days)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 64); // 64 days ago (beyond 3-day eligibility + 60-day review window)

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // First call: fetch order
              return Promise.resolve([{
                id: 'order1',
                buyerId: 'user1',
                sellerId: 'seller1',
                status: 'COMPLETED',
                completedAt: oldDate,
                deliveredAt: null,
                totalCents: 5000,
              }]);
            } else {
              // Second call: check for existing review
              return Promise.resolve([]);
            }
          }),
        }),
      }),
    }) as never);

    const result = await submitReview('order1', validReviewData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Review window closed. You had 60 days');
  });

  it('returns error if review already exists', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5); // 5 days ago (past 3-day eligibility)

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // First call: fetch order
              return Promise.resolve([{
                id: 'order1',
                buyerId: 'user1',
                sellerId: 'seller1',
                status: 'COMPLETED',
                completedAt: pastDate,
                deliveredAt: null,
                totalCents: 5000,
              }]);
            } else {
              // Second call: check for existing review
              return Promise.resolve([{ id: 'review1' }]);
            }
          }),
        }),
      }),
    }) as never);

    const result = await submitReview('order1', validReviewData);

    expect(result).toEqual({ success: false, error: 'You have already reviewed this order' });
  });

  it('creates review and updates seller performance on success', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5); // 5 days ago (past 3-day eligibility)

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          selectCallCount++;
          const queryChain = {
            limit: vi.fn().mockImplementation(() => {
              if (selectCallCount === 1) {
                return Promise.resolve([{
                  id: 'order1',
                  buyerId: 'user1',
                  sellerId: 'seller1',
                  status: 'COMPLETED',
                  completedAt: pastDate,
                  deliveredAt: null,
                  totalCents: 5000,
                }]);
              } else if (selectCallCount === 2) {
                return Promise.resolve([]);
              } else if (selectCallCount === 3) {
                return Promise.resolve([{ id: 'profile1' }]);
              } else {
                return Promise.resolve([]);
              }
            }),
            then: (resolve: (value: unknown) => void) => {
              resolve([{ count: 1, avgRating: 5.0 }]);
              return Promise.resolve([{ count: 1, avgRating: 5.0 }]);
            },
          };
          return queryChain;
        }),
      }),
    }) as never);

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'review1' }]),
      }),
    } as never);

    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never);

    const result = await submitReview('order1', validReviewData);

    expect(result).toEqual({ success: true, reviewId: 'review1' });
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdateSellerPerformance).toHaveBeenCalledWith('seller1');
    expect(mockUpdateReviewVisibility).toHaveBeenCalledWith('order1');
  });
});
