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

// Helper to create chainable mock
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

import {
  createVariationType,
  updateVariationType,
  deactivateVariationType,
  getVariationTypes,
} from '../variation-type-actions';

describe('variation-type-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVariationType', () => {
    it('creates a variation type and returns it', async () => {
      const mockType = {
        id: 'vt-1',
        key: 'SIZE',
        label: 'Size',
        description: null,
        icon: null,
        inputType: 'dropdown',
        isSystem: false,
        isActive: true,
        sortOrder: 0,
        totalListings: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(db.insert).mockReturnValue(chainMock(mockType) as never);
      const result = await createVariationType({ key: 'SIZE', label: 'Size' });
      expect(result.key).toBe('SIZE');
      expect(result.label).toBe('Size');
    });
  });

  describe('updateVariationType', () => {
    it('updates a variation type', async () => {
      const mockType = {
        id: 'vt-1', key: 'SIZE', label: 'Updated Size', description: null,
        icon: null, inputType: 'dropdown', isSystem: false, isActive: true,
        sortOrder: 0, totalListings: 0, createdAt: new Date(), updatedAt: new Date(),
      };
      vi.mocked(db.update).mockReturnValue(chainMock(mockType) as never);
      const result = await updateVariationType('vt-1', { label: 'Updated Size' });
      expect(result.label).toBe('Updated Size');
    });
  });

  describe('deactivateVariationType', () => {
    it('throws for system types', async () => {
      const systemType = {
        id: 'vt-1', key: 'SIZE', label: 'Size', isSystem: true,
        isActive: true, totalListings: 0,
      };
      const selectChain = chainMock();
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([systemType]) }) }),
      } as never);
      await expect(deactivateVariationType('vt-1')).rejects.toThrow('System variation types cannot be deactivated');
    });

    it('throws when type has active listings', async () => {
      const customType = {
        id: 'vt-2', key: 'CUSTOM', label: 'Custom', isSystem: false,
        isActive: true, totalListings: 5,
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([customType]) }) }),
      } as never);
      await expect(deactivateVariationType('vt-2')).rejects.toThrow('Cannot deactivate variation type with active listings');
    });

    it('deactivates a custom type with no listings', async () => {
      const customType = {
        id: 'vt-3', key: 'CUSTOM2', label: 'Custom2', isSystem: false,
        isActive: true, totalListings: 0,
      };
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([customType]) }) }),
      } as never);
      vi.mocked(db.update).mockReturnValue(chainMock() as never);
      await expect(deactivateVariationType('vt-3')).resolves.toBeUndefined();
    });
  });

  describe('getVariationTypes', () => {
    it('returns all types sorted by sortOrder', async () => {
      const types = [
        { id: 'vt-1', key: 'SIZE', sortOrder: 1 },
        { id: 'vt-2', key: 'COLOR', sortOrder: 2 },
      ];
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ orderBy: () => Promise.resolve(types), where: () => ({ orderBy: () => Promise.resolve(types) }) }),
      } as never);
      const result = await getVariationTypes();
      expect(result).toHaveLength(2);
    });

    it('filters active only when requested', async () => {
      const types = [{ id: 'vt-1', key: 'SIZE', isActive: true }];
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ orderBy: () => Promise.resolve(types), where: () => ({ orderBy: () => Promise.resolve(types) }) }),
      } as never);
      const result = await getVariationTypes({ activeOnly: true });
      expect(result).toHaveLength(1);
    });
  });
});
