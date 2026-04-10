import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSearchViaEngine = vi.hoisted(() => vi.fn());

vi.mock('../search-engine', () => ({
  searchViaEngine: mockSearchViaEngine,
}));

import { searchListings } from '../listings';

const baseResult = {
  listings: [
    {
      id: 'lst-1', slug: 'item-1', title: 'Nike Air Jordan', priceCents: 9999,
      originalPriceCents: null, condition: 'VERY_GOOD', brand: 'Nike',
      freeShipping: false, shippingCents: 599, primaryImageUrl: null,
      primaryImageAlt: null, sellerName: 'Bob', sellerUsername: 'bob',
      sellerAvatarUrl: null, sellerAverageRating: null, sellerTotalReviews: 0,
      sellerShowStars: false, isBoosted: false,
    },
  ],
  totalCount: 1,
  page: 1,
  totalPages: 1,
  filters: { q: 'nike' },
};

describe('searchListings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates to searchViaEngine', async () => {
    mockSearchViaEngine.mockResolvedValue(baseResult);

    const result = await searchListings({ q: 'nike' });
    expect(result).toBe(baseResult);
    expect(mockSearchViaEngine).toHaveBeenCalledWith({ q: 'nike' }, undefined);
  });

  it('passes context through to searchViaEngine', async () => {
    mockSearchViaEngine.mockResolvedValue(baseResult);

    await searchListings({ q: 'shoes' }, { userId: 'usr-1' });
    expect(mockSearchViaEngine).toHaveBeenCalledWith({ q: 'shoes' }, { userId: 'usr-1' });
  });

  it('returns empty results when engine returns empty', async () => {
    mockSearchViaEngine.mockResolvedValue({
      listings: [], totalCount: 0, page: 1, totalPages: 0, filters: {},
    });

    const result = await searchListings({});
    expect(result.listings).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('propagates errors from searchViaEngine', async () => {
    mockSearchViaEngine.mockRejectedValue(new Error('engine down'));
    await expect(searchListings({ q: 'test' })).rejects.toThrow('engine down');
  });
});
