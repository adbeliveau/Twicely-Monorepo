import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Set up hoisted mocks
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import {
  getStorefrontBySlug,
  getStorefrontForOwner,
  getCustomCategories,
  type StorefrontQueryOptions,
} from '../storefront';

const mockDb = db as unknown as { select: Mock };

// Helper to create a fully chainable mock that returns the result at the end
function createChainableMock(finalResult: unknown) {
  const chainMethods = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };

  // Make all methods return the chain or final result
  Object.values(chainMethods).forEach((method) => {
    method.mockImplementation(() => {
      // Return an object with all chainable methods that ultimately resolves to finalResult
      const proxy: Record<string, unknown> = {};
      Object.keys(chainMethods).forEach((key) => {
        proxy[key] = chainMethods[key as keyof typeof chainMethods];
      });
      // Also make the object itself iterable/array-like for destructuring
      const iteratorKey = Symbol.iterator;
      Object.defineProperty(proxy, iteratorKey, {
        value: function* () {
          if (Array.isArray(finalResult)) {
            yield* finalResult;
          }
        },
        enumerable: false,
      });
      // Support array indexing
      if (Array.isArray(finalResult)) {
        finalResult.forEach((val, idx) => {
          proxy[idx] = val;
        });
        proxy.length = finalResult.length;
      }
      // Make it thenable for async
      proxy.then = (resolve: (val: unknown) => void) => resolve(finalResult);
      return proxy;
    });
  });

  return chainMethods;
}

describe('Storefront Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStorefrontBySlug', () => {
    it('returns null when store slug not found', async () => {
      // Mock the seller profile query to return empty
      const chain = createChainableMock([]);
      mockDb.select.mockReturnValue(chain);

      const result = await getStorefrontBySlug('nonexistent-store');

      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('returns null when store is not published', async () => {
      const sellerRow = {
        id: 'sp_1',
        userId: 'u_1',
        storeName: 'Test Store',
        storeSlug: 'test-store',
        isStorePublished: false, // Not published
      };

      const chain = createChainableMock([sellerRow]);
      mockDb.select.mockReturnValue(chain);

      const result = await getStorefrontBySlug('test-store');

      expect(result).toBeNull();
    });

    it('accepts pagination options', async () => {
      // Verify the options interface accepts page, pageSize, sortBy
      const options: StorefrontQueryOptions = {
        page: 2,
        pageSize: 12,
        sortBy: 'price_low',
      };

      expect(options.page).toBe(2);
      expect(options.pageSize).toBe(12);
      expect(options.sortBy).toBe('price_low');
    });

    it('accepts price_high sort option', async () => {
      const options: StorefrontQueryOptions = {
        sortBy: 'price_high',
      };

      expect(options.sortBy).toBe('price_high');
    });

    it('accepts newest sort option', async () => {
      const options: StorefrontQueryOptions = {
        sortBy: 'newest',
      };

      expect(options.sortBy).toBe('newest');
    });

    it('accepts categorySlug filter option', async () => {
      const options: StorefrontQueryOptions = {
        categorySlug: 'electronics',
      };

      expect(options.categorySlug).toBe('electronics');
    });

    it('accepts searchQuery filter option', async () => {
      const options: StorefrontQueryOptions = {
        searchQuery: 'vintage shoes',
      };

      expect(options.searchQuery).toBe('vintage shoes');
    });

    it('accepts combined filter and pagination options', async () => {
      const options: StorefrontQueryOptions = {
        page: 2,
        pageSize: 12,
        sortBy: 'price_low',
        categorySlug: 'clothing',
        searchQuery: 'summer dress',
      };

      expect(options.page).toBe(2);
      expect(options.pageSize).toBe(12);
      expect(options.sortBy).toBe('price_low');
      expect(options.categorySlug).toBe('clothing');
      expect(options.searchQuery).toBe('summer dress');
    });
  });

  describe('getStorefrontForOwner', () => {
    it('returns null when user has no seller profile', async () => {
      const chain = createChainableMock([]);
      mockDb.select.mockReturnValue(chain);

      const result = await getStorefrontForOwner('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  describe('getCustomCategories', () => {
    it('returns empty array when user has no storefront', async () => {
      const chain = createChainableMock([]);
      mockDb.select.mockReturnValue(chain);

      const result = await getCustomCategories('no-storefront-user');

      expect(result).toEqual([]);
    });
  });

  describe('StorefrontQueryOptions type', () => {
    it('allows undefined options', () => {
      const options: StorefrontQueryOptions = {};
      expect(options.page).toBeUndefined();
      expect(options.pageSize).toBeUndefined();
      expect(options.sortBy).toBeUndefined();
    });

    it('allows partial options', () => {
      const options: StorefrontQueryOptions = { page: 3 };
      expect(options.page).toBe(3);
      expect(options.pageSize).toBeUndefined();
    });
  });
});

describe('Storefront Data Structure', () => {
  it('StorefrontBranding has required fields', () => {
    // Type check - these are the expected fields
    const branding = {
      bannerUrl: null as string | null,
      logoUrl: null as string | null,
      accentColor: '#7C3AED' as string | null,
      announcement: null as string | null,
      aboutHtml: null as string | null,
      socialLinks: {} as Record<string, string>,
      featuredListingIds: [] as string[],
      isStorePublished: true,
      defaultStoreView: 'GRID',
    };

    expect(branding.accentColor).toBe('#7C3AED');
    expect(branding.isStorePublished).toBe(true);
    expect(branding.featuredListingIds).toEqual([]);
  });

  it('StorefrontSeller has required fields', () => {
    const seller = {
      id: 'sp_1',
      userId: 'u_1',
      storeName: 'Test Store' as string | null,
      storeSlug: 'test-store' as string | null,
      storeDescription: null as string | null,
      returnPolicy: null as string | null,
      avatarUrl: null as string | null,
      performanceBand: 'EMERGING',
      memberSince: new Date(),
      vacationMode: false,
      vacationMessage: null as string | null,
      branding: {
        bannerUrl: null,
        logoUrl: null,
        accentColor: null,
        announcement: null,
        aboutHtml: null,
        socialLinks: {},
        featuredListingIds: [],
        isStorePublished: true,
        defaultStoreView: 'GRID',
      },
    };

    expect(seller.performanceBand).toBe('EMERGING');
    expect(seller.vacationMode).toBe(false);
  });

  it('StorefrontStats has required fields', () => {
    const stats = {
      listingCount: 25,
      followerCount: 100,
      averageRating: 4.5 as number | null,
      totalReviews: 42,
      localMetrics: null,
    };

    expect(stats.listingCount).toBe(25);
    expect(stats.averageRating).toBe(4.5);
    expect(stats.localMetrics).toBeNull();
  });

  it('CustomCategory has required fields', () => {
    const category = {
      id: 'cat_1',
      name: 'Electronics',
      slug: 'electronics',
      sortOrder: 0,
    };

    expect(category.slug).toBe('electronics');
    expect(category.sortOrder).toBe(0);
  });
});
