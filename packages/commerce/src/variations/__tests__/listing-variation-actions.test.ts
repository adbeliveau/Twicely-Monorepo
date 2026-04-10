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
  setListingVariations,
  getListingVariationMatrix,
  applyCategoryDefaults,
} from '../listing-variation-actions';

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

describe('listing-variation-actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('setListingVariations', () => {
    it('enforces max dimensions per listing (default 3, hard cap 5)', async () => {
      await expect(setListingVariations('l-1', {
        dimensions: [
          { variationTypeId: 'vt-1', values: [] },
          { variationTypeId: 'vt-2', values: [] },
          { variationTypeId: 'vt-3', values: [] },
          { variationTypeId: 'vt-4', values: [] },
        ],
      })).rejects.toThrow('Maximum 3 variation dimensions per listing');
    });

    it('deletes existing and inserts new dimensions', async () => {
      vi.mocked(db.delete).mockReturnValue(chainMock() as never);
      vi.mocked(db.insert).mockReturnValue(chainMock({ id: 'lv-1' }) as never);
      await setListingVariations('l-1', {
        dimensions: [{
          variationTypeId: 'vt-1',
          values: [{ displayValue: 'Small' }, { displayValue: 'Medium' }],
        }],
      });
      expect(db.delete).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('applyCategoryDefaults', () => {
    it('skips if listing already has variations', async () => {
      // First call returns category types, second returns existing variations
      let callIdx = 0;
      vi.mocked(db.select).mockReturnValue({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([{ variationTypeId: 'vt-1', sortOrder: 0 }]),
            limit: () => { callIdx++; return Promise.resolve(callIdx <= 1 ? [{ id: 'lv-existing' }] : []); },
          }),
        }),
      } as never);
      await applyCategoryDefaults('l-1', 'cat-1');
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
