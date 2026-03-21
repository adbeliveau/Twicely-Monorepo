import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSellerReviewSummary, getSellerReviews, getSellerDSRAverages } from '../reviews';
import { db } from '@twicely/db';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockDb = vi.mocked(db);

describe('Review Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSellerReviewSummary', () => {
    it('returns seller review summary when seller profile and performance exist', async () => {
      // Mock sellerProfile query
      const profileSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'profile-123' }]),
          }),
        }),
      });

      // Mock sellerPerformance query
      const performanceSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                averageRating: 4.5,
                displayStars: 4.5,
                totalReviews: 42,
                currentBand: 'TOP_RATED',
                trustBadge: 'Top Rated',
                trustBadgeSecondary: ['Fast Shipping', 'Responsive'],
                showStars: true,
              },
            ]),
          }),
        }),
      });

      mockDb.select.mockImplementationOnce(profileSelect).mockImplementationOnce(performanceSelect);

      const result = await getSellerReviewSummary('seller-456');

      expect(result).toEqual({
        averageRating: 4.5,
        displayStars: 4.5,
        totalReviews: 42,
        currentBand: 'TOP_RATED',
        trustBadge: 'Top Rated',
        trustBadgeSecondary: ['Fast Shipping', 'Responsive'],
        showStars: true,
      });
    });

    it('returns null when seller profile does not exist', async () => {
      const profileSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select.mockImplementationOnce(profileSelect);

      const result = await getSellerReviewSummary('nonexistent-seller');

      expect(result).toBeNull();
    });

    it('returns null when seller performance does not exist', async () => {
      const profileSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'profile-123' }]),
          }),
        }),
      });

      const performanceSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockDb.select.mockImplementationOnce(profileSelect).mockImplementationOnce(performanceSelect);

      const result = await getSellerReviewSummary('seller-456');

      expect(result).toBeNull();
    });
  });

  describe('getSellerReviews', () => {
    it('returns paginated reviews with correct structure', async () => {
      // Mock count query
      const countSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 15 }]),
        }),
      });

      // Mock reviews query
      const reviewsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([
                  {
                    reviewId: 'review-1',
                    rating: 5,
                    title: 'Great product!',
                    body: 'Very satisfied with this purchase.',
                    photos: ['photo1.jpg', 'photo2.jpg'],
                    dsrItemAsDescribed: 5,
                    dsrShippingSpeed: 4,
                    dsrCommunication: 5,
                    dsrPackaging: 5,
                    createdAt: new Date('2024-01-15'),
                    isVerifiedPurchase: true,
                    reviewerName: 'John Smith',
                    reviewerAvatarUrl: 'avatar.jpg',
                    responseId: 'response-1',
                    responseBody: 'Thank you for your feedback!',
                    responseCreatedAt: new Date('2024-01-16'),
                  },
                  {
                    reviewId: 'review-2',
                    rating: 4,
                    title: null,
                    body: 'Good quality',
                    photos: null,
                    dsrItemAsDescribed: null,
                    dsrShippingSpeed: null,
                    dsrCommunication: null,
                    dsrPackaging: null,
                    createdAt: new Date('2024-01-10'),
                    isVerifiedPurchase: false,
                    reviewerName: 'Jane Doe',
                    reviewerAvatarUrl: null,
                    responseId: null,
                    responseBody: null,
                    responseCreatedAt: null,
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockImplementationOnce(countSelect).mockImplementationOnce(reviewsSelect);

      const result = await getSellerReviews('seller-456', { page: 1, pageSize: 10 });

      expect(result.totalCount).toBe(15);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(2);
      expect(result.reviews).toHaveLength(2);

      // Check first review structure
      expect(result.reviews[0]).toMatchObject({
        id: 'review-1',
        rating: 5,
        title: 'Great product!',
        body: 'Very satisfied with this purchase.',
        photos: ['photo1.jpg', 'photo2.jpg'],
        isVerifiedPurchase: true,
        reviewerDisplayName: 'John S.',
      });

      expect(result.reviews[0]?.response).toMatchObject({
        id: 'response-1',
        body: 'Thank you for your feedback!',
      });

      // Check second review (no response)
      expect(result.reviews[1]?.reviewerDisplayName).toBe('Jane D.');
      expect(result.reviews[1]?.response).toBeNull();
    });

    it('returns empty result when no reviews exist', async () => {
      const countSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockDb.select.mockImplementationOnce(countSelect);

      const result = await getSellerReviews('seller-no-reviews');

      expect(result).toEqual({
        reviews: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });
    });
  });

  describe('getSellerDSRAverages', () => {
    it('returns DSR averages when reviews exist', async () => {
      const dsrSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              avgItemAsDescribed: 4.8,
              avgShippingSpeed: 4.5,
              avgCommunication: 4.9,
              avgPackaging: 4.7,
            },
          ]),
        }),
      });

      mockDb.select.mockImplementationOnce(dsrSelect);

      const result = await getSellerDSRAverages('seller-456');

      expect(result).toEqual({
        avgItemAsDescribed: 4.8,
        avgShippingSpeed: 4.5,
        avgCommunication: 4.9,
        avgPackaging: 4.7,
      });
    });

    it('returns null averages when no DSR data exists', async () => {
      const dsrSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              avgItemAsDescribed: null,
              avgShippingSpeed: null,
              avgCommunication: null,
              avgPackaging: null,
            },
          ]),
        }),
      });

      mockDb.select.mockImplementationOnce(dsrSelect);

      const result = await getSellerDSRAverages('seller-new');

      expect(result).toEqual({
        avgItemAsDescribed: null,
        avgShippingSpeed: null,
        avgCommunication: null,
        avgPackaging: null,
      });
    });
  });
});
