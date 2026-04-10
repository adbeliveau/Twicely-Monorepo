import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { db } from '@twicely/db';
import {
  createListingChild,
  updateListingChild,
  deleteListingChild,
  getListingChildren,
  bulkCreateChildren,
} from '../listing-child-actions';

function chainMock(returnVal?: unknown) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      if (prop === 'returning') return () => Promise.resolve(returnVal !== undefined ? [returnVal] : []);
      return (..._args: unknown[]) => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

describe('listing-child-actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('createListingChild', () => {
    it('creates a child with auto-generated SKU', async () => {
      const mockChild = {
        id: 'lc-1', parentListingId: 'listing-abc12345',
        variationCombination: { SIZE: 'M', COLOR: 'Red' },
        sku: '12345-m-red', priceCents: 2500,
        compareAtPriceCents: null, costCents: null,
        quantity: 10, availableQuantity: 10, reservedQuantity: 0,
        lowStockThreshold: 5, weightOz: null, barcode: null,
        isActive: true, isDefault: false,
        createdAt: new Date(), updatedAt: new Date(),
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      } as never);
      vi.mocked(db.insert).mockReturnValue(chainMock(mockChild) as never);
      vi.mocked(db.update).mockReturnValue(chainMock() as never);
      const result = await createListingChild({
        parentListingId: 'listing-abc12345',
        variationCombination: { SIZE: 'M', COLOR: 'Red' },
        priceCents: 2500, quantity: 10,
      });
      expect(result.priceCents).toBe(2500);
      expect(result.availableQuantity).toBe(10);
    });

    it('rejects priceCents <= 0', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => Promise.resolve([]) }),
      } as never);
      await expect(createListingChild({
        parentListingId: 'l-1',
        variationCombination: { SIZE: 'M' },
        priceCents: 0, quantity: 1,
      })).rejects.toThrow('priceCents must be greater than 0');
    });

    it('enforces max SKU combinations (250 default)', async () => {
      const existing = Array.from({ length: 250 }, (_, i) => ({ id: 'lc-' + i }));
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => Promise.resolve(existing) }),
      } as never);
      await expect(createListingChild({
        parentListingId: 'l-1',
        variationCombination: { SIZE: 'XL' },
        priceCents: 1000, quantity: 1,
      })).rejects.toThrow('Maximum SKU combinations reached');
    });
  });

  describe('updateListingChild', () => {
    it('recalculates availableQuantity on qty update', async () => {
      const existing = { id: 'lc-1', parentListingId: 'l-1', reservedQuantity: 3, quantity: 10, availableQuantity: 7 };
      const updated = { ...existing, quantity: 20, availableQuantity: 17 };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([existing]) }) }),
      } as never);
      vi.mocked(db.update).mockReturnValue(chainMock(updated) as never);
      const result = await updateListingChild('lc-1', { quantity: 20 });
      expect(result.availableQuantity).toBe(17);
    });
  });

  describe('getListingChildren', () => {
    it('returns children ordered by createdAt', async () => {
      const children = [{ id: 'lc-1' }, { id: 'lc-2' }];
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ orderBy: () => Promise.resolve(children) }) }),
      } as never);
      const result = await getListingChildren('l-1');
      expect(result).toHaveLength(2);
    });
  });
});
