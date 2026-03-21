import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbInsert = vi.fn();
const mockDb = { insert: mockDbInsert };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  listingPriceHistory: { id: 'id' },
}));

describe('Price History Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('recordPriceChange', () => {
    it('records price change with MANUAL reason', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({ values: mockValues });

      const { recordPriceChange } = await import('../price-history-service');
      await recordPriceChange({
        listingId: 'listing-1',
        newPriceCents: 2500,
        previousCents: null,
        changeReason: 'MANUAL',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: 'listing-1',
          priceCents: 2500,
          previousCents: null,
          changeReason: 'MANUAL',
          changedByUserId: null,
        })
      );
    });

    it('records price change with PROMOTION reason', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({ values: mockValues });

      const { recordPriceChange } = await import('../price-history-service');
      await recordPriceChange({
        listingId: 'listing-1',
        newPriceCents: 2000,
        previousCents: 2500,
        changeReason: 'PROMOTION',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          priceCents: 2000,
          previousCents: 2500,
          changeReason: 'PROMOTION',
        })
      );
    });

    it('records price change with OFFER_ACCEPTED reason', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({ values: mockValues });

      const { recordPriceChange } = await import('../price-history-service');
      await recordPriceChange({
        listingId: 'listing-1',
        newPriceCents: 1800,
        previousCents: 2000,
        changeReason: 'OFFER_ACCEPTED',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          changeReason: 'OFFER_ACCEPTED',
        })
      );
    });

    it('records changedByUserId when provided', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({ values: mockValues });

      const { recordPriceChange } = await import('../price-history-service');
      await recordPriceChange({
        listingId: 'listing-1',
        newPriceCents: 2500,
        previousCents: 3000,
        changeReason: 'MANUAL',
        changedByUserId: 'user-123',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          changedByUserId: 'user-123',
        })
      );
    });

    it('records price change with SMART_DROP reason', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({ values: mockValues });

      const { recordPriceChange } = await import('../price-history-service');
      await recordPriceChange({
        listingId: 'listing-1',
        newPriceCents: 4500,
        previousCents: 5000,
        changeReason: 'SMART_DROP',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          changeReason: 'SMART_DROP',
        })
      );
    });
  });
});
