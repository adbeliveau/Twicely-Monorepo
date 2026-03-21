import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  listingPriceHistory: { listingId: 'listingId', priceCents: 'priceCents', previousCents: 'previousCents', createdAt: 'createdAt' },
  listing: { id: 'id', priceCents: 'priceCents', createdAt: 'createdAt' },
  listingImage: { listingId: 'listingId', url: 'url', isPrimary: 'isPrimary' },
}));

describe('Price History Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getPriceHistory', () => {
    it('returns empty array when listing not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const { getPriceHistory } = await import('../price-history');
      const result = await getPriceHistory('nonexistent');

      expect(result).toEqual([]);
    });

    it('returns single point when no price history exists', async () => {
      const createdAt = new Date('2024-01-01');
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ priceCents: 2500, createdAt }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      const { getPriceHistory } = await import('../price-history');
      const result = await getPriceHistory('listing-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ priceCents: 2500, recordedAt: createdAt });
    });

    it('returns price history timeline with initial price', async () => {
      const createdAt = new Date('2024-01-01');
      const changeDate = new Date('2024-01-15');

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ priceCents: 2000, createdAt }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { priceCents: 2000, previousCents: 2500, createdAt: changeDate },
              ]),
            }),
          }),
        });

      const { getPriceHistory } = await import('../price-history');
      const result = await getPriceHistory('listing-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ priceCents: 2500, recordedAt: createdAt });
      expect(result[1]).toEqual({ priceCents: 2000, recordedAt: changeDate });
    });
  });

  describe('getSoldComparables', () => {
    it('returns empty array when no sold listings in category', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const { getSoldComparables } = await import('../price-history');
      const result = await getSoldComparables('listing-1', 'cat-1');

      expect(result).toEqual([]);
    });

    it('returns sold listings with image URLs', async () => {
      const soldAt = new Date('2024-01-20');

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'sold-1',
                    title: 'Sold Item',
                    slug: 'sold-item',
                    priceCents: 3000,
                    condition: 'VERY_GOOD',
                    soldAt,
                  },
                ]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { listingId: 'sold-1', url: 'https://example.com/img.jpg' },
            ]),
          }),
        });

      const { getSoldComparables } = await import('../price-history');
      const result = await getSoldComparables('listing-1', 'cat-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'sold-1',
        title: 'Sold Item',
        slug: 'sold-item',
        priceCents: 3000,
        condition: 'VERY_GOOD',
        imageUrl: 'https://example.com/img.jpg',
        soldAt,
      });
    });

    it('handles missing images gracefully', async () => {
      const soldAt = new Date('2024-01-20');

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 'sold-1',
                    title: null,
                    slug: null,
                    priceCents: null,
                    condition: null,
                    soldAt,
                  },
                ]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const { getSoldComparables } = await import('../price-history');
      const result = await getSoldComparables('listing-1', 'cat-1');

      expect(result[0]).toEqual({
        id: 'sold-1',
        title: 'Untitled',
        slug: 'sold-1',
        priceCents: 0,
        condition: 'GOOD',
        imageUrl: null,
        soldAt,
      });
    });
  });
});
