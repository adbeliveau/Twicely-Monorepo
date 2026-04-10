import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTx = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock('@twicely/db', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { db } from '@twicely/db';
import {
  reserveStock,
  releaseReservation,
  convertReservation,
  getAvailableQuantity,
} from '../reservation-actions';

function txChainMock(returnVal?: unknown) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      if (prop === 'returning') return () => Promise.resolve(returnVal !== undefined ? [returnVal] : []);
      if (prop === 'for') return () => Promise.resolve(returnVal !== undefined ? [returnVal] : []);
      return (..._args: unknown[]) => new Proxy(chain, handler);
    },
  };
  return new Proxy(chain, handler);
}

describe('reservation-actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('reserveStock', () => {
    it('reserves stock and decrements availableQuantity', async () => {
      const child = { id: 'lc-1', availableQuantity: 10, reservedQuantity: 0 };
      const reservation = { id: 'vr-1', listingChildId: 'lc-1', quantity: 2, status: 'ACTIVE' };
      mockTx.select.mockReturnValue(txChainMock(child));
      mockTx.insert.mockReturnValue(txChainMock(reservation));
      mockTx.update.mockReturnValue(txChainMock());
      const result = await reserveStock({ listingChildId: 'lc-1', userId: 'u-1', quantity: 2 });
      expect(result.success).toBe(true);
      expect(result.reservationId).toBe('vr-1');
    });

    it('fails when insufficient stock', async () => {
      const child = { id: 'lc-1', availableQuantity: 1, reservedQuantity: 9 };
      mockTx.select.mockReturnValue(txChainMock(child));
      const result = await reserveStock({ listingChildId: 'lc-1', userId: 'u-1', quantity: 5 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient stock');
    });
  });

  describe('getAvailableQuantity', () => {
    it('returns available quantity for a variant', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ availableQuantity: 7 }]) }) }),
      } as never);
      const qty = await getAvailableQuantity('lc-1');
      expect(qty).toBe(7);
    });

    it('returns 0 for non-existent variant', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      } as never);
      const qty = await getAvailableQuantity('nonexistent');
      expect(qty).toBe(0);
    });
  });
});
