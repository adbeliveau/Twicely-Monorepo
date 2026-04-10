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
  normalizeValue,
  createVariationValue,
  getVariationValues,
  promoteValueToPlatform,
  deactivateValue,
  bulkCleanupUnusedValues,
} from '../variation-value-actions';

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

describe('variation-value-actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('normalizeValue', () => {
    it('lowercases and trims whitespace', () => {
      expect(normalizeValue('  Extra   Large  ')).toBe('extra large');
    });
    it('handles single word', () => {
      expect(normalizeValue('Red')).toBe('red');
    });
  });

  describe('createVariationValue', () => {
    it('creates a value with normalized dedup key', async () => {
      const mockVal = {
        id: 'vv-1', variationTypeId: 'vt-1', value: 'Red',
        normalizedValue: 'red', scope: 'PLATFORM', colorHex: '#FF0000',
        categoryId: null, sellerId: null, imageUrl: null,
        usageCount: 0, lastUsedAt: null, isActive: true,
        promotedAt: null, promotedBy: null, sortOrder: 0,
        createdAt: new Date(), updatedAt: new Date(),
      };
      // Mock select for dedup check (no existing)
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      } as never);
      vi.mocked(db.insert).mockReturnValue(chainMock(mockVal) as never);
      const result = await createVariationValue({
        variationTypeId: 'vt-1', value: 'Red', scope: 'PLATFORM', colorHex: '#FF0000',
      });
      expect(result.value).toBe('Red');
      expect(result.colorHex).toBe('#FF0000');
    });

    it('rejects duplicates within same scope', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'existing' }]) }) }),
      } as never);
      await expect(createVariationValue({
        variationTypeId: 'vt-1', value: 'Red', scope: 'PLATFORM',
      })).rejects.toThrow('Duplicate variation value');
    });
  });

  describe('getVariationValues', () => {
    it('returns values grouped by scope', async () => {
      const platformVals = [{ id: 'vv-1', scope: 'PLATFORM' }];
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ orderBy: () => Promise.resolve(platformVals) }) }),
      } as never);
      const result = await getVariationValues({ variationTypeId: 'vt-1' });
      expect(result.platform).toHaveLength(1);
      expect(result.category).toHaveLength(0);
      expect(result.seller).toHaveLength(0);
    });
  });

  describe('promoteValueToPlatform', () => {
    it('updates scope and records promoter', async () => {
      vi.mocked(db.update).mockReturnValue(chainMock() as never);
      await promoteValueToPlatform('vv-1', 'staff-1');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('deactivateValue', () => {
    it('sets isActive to false', async () => {
      vi.mocked(db.update).mockReturnValue(chainMock() as never);
      await deactivateValue('vv-1');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('bulkCleanupUnusedValues', () => {
    it('returns count of unused values in dry run', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => Promise.resolve([{ id: 'vv-unused-1' }]) }),
      } as never);
      const result = await bulkCleanupUnusedValues({ dryRun: true });
      expect(result.removed).toBe(1);
    });

    it('deactivates unused values in live run', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => Promise.resolve([{ id: 'vv-unused-1' }]) }),
      } as never);
      vi.mocked(db.update).mockReturnValue(chainMock() as never);
      const result = await bulkCleanupUnusedValues();
      expect(result.removed).toBe(1);
      expect(db.update).toHaveBeenCalled();
    });
  });
});
