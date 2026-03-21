import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
};

const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize }));

describe('Browsing History Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getBrowsingHistory', () => {
    it('returns viewed items with listing data', async () => {
      const mockRows = [
        {
          listingId: 'listing-1',
          title: 'Test Item',
          slug: 'test-item',
          priceCents: 1500,
          condition: 'VERY_GOOD',
          imageUrl: 'https://example.com/img.jpg',
          sellerName: 'John',
          viewCount: 3,
          lastViewedAt: new Date('2024-01-15'),
          didAddToCart: false,
          didAddToWatchlist: true,
          didMakeOffer: false,
          didPurchase: false,
        },
      ];
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue(mockRows),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const { getBrowsingHistory } = await import('@/lib/queries/browsing-history');
      const result = await getBrowsingHistory('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Test Item');
      expect(result[0]?.priceCents).toBe(1500);
      expect(result[0]?.condition).toBe('VERY_GOOD');
    });

    it('returns empty array when no history', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
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
      });

      const { getBrowsingHistory } = await import('@/lib/queries/browsing-history');
      const result = await getBrowsingHistory('user-1');

      expect(result).toEqual([]);
    });

    it('handles null fields with defaults', async () => {
      const mockRows = [
        {
          listingId: 'listing-1',
          title: null,
          slug: null,
          priceCents: null,
          condition: null,
          imageUrl: null,
          sellerName: null,
          viewCount: 1,
          lastViewedAt: new Date('2024-01-15'),
          didAddToCart: false,
          didAddToWatchlist: false,
          didMakeOffer: false,
          didPurchase: false,
        },
      ];
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue(mockRows),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const { getBrowsingHistory } = await import('@/lib/queries/browsing-history');
      const result = await getBrowsingHistory('user-1');

      expect(result[0]?.title).toBe('Untitled');
      expect(result[0]?.slug).toBe('listing-1');
      expect(result[0]?.priceCents).toBe(0);
      expect(result[0]?.condition).toBe('GOOD');
    });
  });
});
