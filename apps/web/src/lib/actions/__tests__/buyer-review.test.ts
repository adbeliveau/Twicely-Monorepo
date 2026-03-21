import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before imports
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
}));

vi.mock('@twicely/commerce/review-visibility', () => ({
  updateReviewVisibility: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { submitBuyerReview, updateBuyerReview } from '../buyer-review';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { updateReviewVisibility } from '@twicely/commerce/review-visibility';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdateReviewVisibility = vi.mocked(updateReviewVisibility);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

describe('submitBuyerReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('creates review successfully for DELIVERED order within 14-day window', async () => {
    const deliveredAt = new Date();
    deliveredAt.setDate(deliveredAt.getDate() - 2); // 2 days ago

    mockAuthorize.mockResolvedValue({
      session: { userId: 'seller1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              // First call: fetch order
              return Promise.resolve([{
                sellerId: 'seller1',
                buyerId: 'buyer1',
                status: 'DELIVERED',
                deliveredAt,
              }]);
            } else {
              // Second call: check for existing review
              return Promise.resolve([]);
            }
          }),
        }),
      }),
    }) as never);

    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    mockUpdateReviewVisibility.mockResolvedValue(undefined);

    const result = await submitBuyerReview({
      orderId: 'order1',
      ratingPayment: 4,
      ratingCommunication: 5,
      ratingReturnBehavior: null,
      note: 'Great buyer!',
    });

    expect(result.success).toBe(true);
    expect(result.reviewId).toBeDefined();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdateReviewVisibility).toHaveBeenCalledWith('order1');
  });
  it('rejects non-seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            sellerId: 'seller1',
            buyerId: 'buyer1',
            status: 'DELIVERED',
            deliveredAt: new Date(),
          }]),
        }),
      }),
    } as never);

    const result = await submitBuyerReview({
      orderId: 'order1',
      ratingPayment: 4,
      ratingCommunication: 5,
      ratingReturnBehavior: null,
      note: null,
    });

    expect(result).toEqual({ success: false, error: 'Only the seller can rate the buyer' });
  });
  it('rejects expired window (61 days after delivery)', async () => {
    const deliveredAt = new Date();
    deliveredAt.setDate(deliveredAt.getDate() - 61); // 61 days ago (beyond default 30-day window)

    mockAuthorize.mockResolvedValue({
      session: { userId: 'seller1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve([{
                sellerId: 'seller1',
                buyerId: 'buyer1',
                status: 'DELIVERED',
                deliveredAt,
              }]);
            } else {
              return Promise.resolve([]);
            }
          }),
        }),
      }),
    }) as never);

    const result = await submitBuyerReview({
      orderId: 'order1',
      ratingPayment: 4,
      ratingCommunication: 5,
      ratingReturnBehavior: null,
      note: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('window closed');
  });
  it('rejects duplicate review', async () => {
    const deliveredAt = new Date();
    deliveredAt.setDate(deliveredAt.getDate() - 2);

    mockAuthorize.mockResolvedValue({
      session: { userId: 'seller1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve([{
                sellerId: 'seller1',
                buyerId: 'buyer1',
                status: 'DELIVERED',
                deliveredAt,
              }]);
            } else {
              // Existing review found
              return Promise.resolve([{ id: 'existing-review' }]);
            }
          }),
        }),
      }),
    }) as never);

    const result = await submitBuyerReview({
      orderId: 'order1',
      ratingPayment: 4,
      ratingCommunication: 5,
      ratingReturnBehavior: null,
      note: null,
    });

    expect(result).toEqual({ success: false, error: 'Buyer already reviewed for this order' });
  });
  it('calculates overallRating correctly with null returnBehavior', async () => {
    const deliveredAt = new Date();
    deliveredAt.setDate(deliveredAt.getDate() - 2);

    mockAuthorize.mockResolvedValue({
      session: { userId: 'seller1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return Promise.resolve([{
                sellerId: 'seller1',
                buyerId: 'buyer1',
                status: 'DELIVERED',
                deliveredAt,
              }]);
            } else {
              return Promise.resolve([]);
            }
          }),
        }),
      }),
    }) as never);

    let insertedValues: Record<string, unknown> | null = null;
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((vals) => {
        insertedValues = vals;
        return Promise.resolve(undefined);
      }),
    } as never);

    mockUpdateReviewVisibility.mockResolvedValue(undefined);

    await submitBuyerReview({
      orderId: 'order1',
      ratingPayment: 4,
      ratingCommunication: 5,
      ratingReturnBehavior: null,
      note: null,
    });

    // (4 + 5) / 2 = 4.5 → Math.round → 5
    expect(insertedValues).not.toBeNull();
    expect(insertedValues!.overallRating).toBe(5);
  });
});
describe('updateBuyerReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  it('rejects expired edit window (49 hours after creation)', async () => {
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - 49); // 49 hours ago (default edit window = 48h)

    mockAuthorize.mockResolvedValue({
      session: { userId: 'seller1' } as never,
      ability: { can: vi.fn().mockReturnValue(true) } as never,
    });

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'review1',
            orderId: 'order1',
            sellerUserId: 'seller1',
            createdAt,
          }]),
        }),
      }),
    } as never);

    const result = await updateBuyerReview({
      reviewId: 'review1',
      ratingPayment: 4,
      ratingCommunication: 5,
      ratingReturnBehavior: null,
      note: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Edit window closed');
  });
});
