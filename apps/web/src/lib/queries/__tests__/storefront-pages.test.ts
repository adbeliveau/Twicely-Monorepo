import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: mockSelect,
  },
}));

import {
  getStorefrontIdForOwner,
  getPagesForOwner,
  getPageForEditor,
  getPublishedPageBySlug,
  getPublishedPagesNav,
} from '../storefront-pages';

// Chainable mock that resolves to finalResult on any terminal call
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

  Object.values(chainMethods).forEach((method) => {
    method.mockImplementation(() => {
      const proxy: Record<string, unknown> = {};
      Object.keys(chainMethods).forEach((key) => {
        proxy[key] = chainMethods[key as keyof typeof chainMethods];
      });
      const iteratorKey = Symbol.iterator;
      Object.defineProperty(proxy, iteratorKey, {
        value: function* () {
          if (Array.isArray(finalResult)) yield* finalResult;
        },
        enumerable: false,
      });
      if (Array.isArray(finalResult)) {
        finalResult.forEach((val, idx) => { proxy[idx] = val; });
        proxy.length = finalResult.length;
      }
      proxy.then = (resolve: (val: unknown) => void) => resolve(finalResult);
      return proxy;
    });
  });

  return chainMethods;
}

describe('Storefront Pages Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStorefrontIdForOwner', () => {
    it('returns null when user has no storefront', async () => {
      mockSelect.mockReturnValue(createChainableMock([]));
      const result = await getStorefrontIdForOwner('no-store-user');
      expect(result).toBeNull();
    });

    it('returns storefront id when found', async () => {
      mockSelect.mockReturnValue(createChainableMock([{ id: 'sf-1' }]));
      const result = await getStorefrontIdForOwner('user-1');
      expect(result).toBe('sf-1');
    });
  });

  describe('getPagesForOwner', () => {
    it('returns empty array when user has no storefront', async () => {
      mockSelect.mockReturnValue(createChainableMock([]));
      const result = await getPagesForOwner('no-store-user');
      expect(result).toEqual([]);
    });

    it('returns pages when storefront exists', async () => {
      // First call: storefront lookup
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      // Second call: pages query
      const pages = [
        { id: 'p-1', slug: 'about', title: 'About', isPublished: true, sortOrder: 0, updatedAt: new Date() },
        { id: 'p-2', slug: 'faq', title: 'FAQ', isPublished: false, sortOrder: 1, updatedAt: new Date() },
      ];
      mockSelect.mockReturnValueOnce(createChainableMock(pages));

      const result = await getPagesForOwner('user-1');
      expect(result).toHaveLength(2);
      expect(result[0]?.title).toBe('About');
    });
  });

  describe('getPageForEditor', () => {
    it('returns null when user has no storefront', async () => {
      mockSelect.mockReturnValue(createChainableMock([]));
      const result = await getPageForEditor('no-store-user', 'p-1');
      expect(result).toBeNull();
    });

    it('returns null when page not found for storefront', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      mockSelect.mockReturnValueOnce(createChainableMock([]));
      const result = await getPageForEditor('user-1', 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns page data when found and ownership matches', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      const pageData = {
        id: 'p-1', slug: 'about', title: 'About Us',
        puckData: { content: [] }, isPublished: false, storefrontId: 'sf-1',
      };
      mockSelect.mockReturnValueOnce(createChainableMock([pageData]));

      const result = await getPageForEditor('user-1', 'p-1');
      expect(result).toEqual(pageData);
    });
  });

  describe('getPublishedPageBySlug', () => {
    it('returns null when store slug not found', async () => {
      mockSelect.mockReturnValue(createChainableMock([]));
      const result = await getPublishedPageBySlug('nonexistent', 'about');
      expect(result).toBeNull();
    });

    it('returns upgradeRequired when seller below POWER tier', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([
        { userId: 'u-1', storeTier: 'PRO', storeName: 'Test', storeSlug: 'test' },
      ]));

      const result = await getPublishedPageBySlug('test', 'about');
      expect(result).toEqual({ upgradeRequired: true });
    });

    it('returns null when page slug not found', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([
        { userId: 'u-1', storeTier: 'POWER', storeName: 'Test', storeSlug: 'test' },
      ]));
      // storefront lookup
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      // page lookup
      mockSelect.mockReturnValueOnce(createChainableMock([]));

      const result = await getPublishedPageBySlug('test', 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns page data for POWER tier seller', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([
        { userId: 'u-1', storeTier: 'POWER', storeName: 'Test Store', storeSlug: 'test' },
      ]));
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      mockSelect.mockReturnValueOnce(createChainableMock([
        { title: 'About Us', puckData: { content: [] } },
      ]));

      const result = await getPublishedPageBySlug('test', 'about');
      expect(result).toEqual({
        upgradeRequired: false,
        page: {
          title: 'About Us',
          puckData: { content: [] },
          storeName: 'Test Store',
          storeSlug: 'test',
        },
      });
    });

    it('returns page data for ENTERPRISE tier seller', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([
        { userId: 'u-1', storeTier: 'ENTERPRISE', storeName: 'Big Store', storeSlug: 'big' },
      ]));
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      mockSelect.mockReturnValueOnce(createChainableMock([
        { title: 'FAQ', puckData: { content: [{ type: 'FAQ' }] } },
      ]));

      const result = await getPublishedPageBySlug('big', 'faq');
      expect(result).not.toBeNull();
      if (result && !result.upgradeRequired) {
        expect(result.page.title).toBe('FAQ');
      }
    });
  });

  describe('getPublishedPagesNav', () => {
    it('returns empty array when store not found', async () => {
      mockSelect.mockReturnValue(createChainableMock([]));
      const result = await getPublishedPagesNav('nonexistent');
      expect(result).toEqual([]);
    });

    it('returns empty array when seller below POWER', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([
        { userId: 'u-1', storeTier: 'STARTER' },
      ]));
      const result = await getPublishedPagesNav('test');
      expect(result).toEqual([]);
    });

    it('returns published page nav items for POWER seller', async () => {
      mockSelect.mockReturnValueOnce(createChainableMock([
        { userId: 'u-1', storeTier: 'POWER' },
      ]));
      mockSelect.mockReturnValueOnce(createChainableMock([{ id: 'sf-1' }]));
      mockSelect.mockReturnValueOnce(createChainableMock([
        { title: 'About', slug: 'about' },
        { title: 'FAQ', slug: 'faq' },
      ]));

      const result = await getPublishedPagesNav('test');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ title: 'About', slug: 'about' });
    });
  });
});
