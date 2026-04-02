import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple mock structures that can be chained
const createMockChain = () => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
});

const createInsertChain = () => ({
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
});

const createUpdateChain = () => ({
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
});

const mockDb = {
  select: vi.fn(() => createMockChain()),
  insert: vi.fn(() => createInsertChain()),
  update: vi.fn(() => createUpdateChain()),
};

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn().mockResolvedValue({
    session: { userId: 'seller-1' },
    ability: { can: () => true },
  }),
}));

describe('watcher-offers module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset mock implementations for each test
    mockDb.select.mockImplementation(() => createMockChain());
    mockDb.insert.mockImplementation(() => createInsertChain());
    mockDb.update.mockImplementation(() => createUpdateChain());
  });

  describe('createWatcherOffer', () => {
    it('exports createWatcherOffer function', async () => {
      const mod = await import('../watcher-offers');
      expect(typeof mod.createWatcherOffer).toBe('function');
    });

    it('returns error when listing not found', async () => {
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([]); // No listing found
      mockDb.select.mockReturnValueOnce(selectChain);

      const { createWatcherOffer } = await import('../watcher-offers');
      const result = await createWatcherOffer({
        listingId: 'nonexistent',
        discountedPriceCents: 8000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Listing not found');
    });

    it('returns error when seller does not own listing', async () => {
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([{
        id: 'listing-1',
        ownerId: 'other-seller',
        priceCents: 10000,
        status: 'ACTIVE',
      }]);
      mockDb.select.mockReturnValueOnce(selectChain);

      const { createWatcherOffer } = await import('../watcher-offers');
      const result = await createWatcherOffer({
        listingId: 'listing-1',
        discountedPriceCents: 8000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('You do not own this listing');
    });

    it('returns error when discounted price >= current price', async () => {
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([{
        id: 'listing-1',
        ownerId: 'seller-1',
        priceCents: 10000,
        status: 'ACTIVE',
      }]);
      mockDb.select.mockReturnValueOnce(selectChain);

      const { createWatcherOffer } = await import('../watcher-offers');
      const result = await createWatcherOffer({
        listingId: 'listing-1',
        discountedPriceCents: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Discounted price must be less than current price');
    });
  });

  describe('acceptWatcherOffer', () => {
    it('exports acceptWatcherOffer function', async () => {
      const mod = await import('../watcher-offers');
      expect(typeof mod.acceptWatcherOffer).toBe('function');
    });

    it('returns error when offer not found', async () => {
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([]); // No offer found
      mockDb.select.mockReturnValueOnce(selectChain);

      const { acceptWatcherOffer } = await import('../watcher-offers');
      const result = await acceptWatcherOffer({
        watcherOfferId: 'nonexistent',
        shippingAddressId: 'addr-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Watcher offer not found');
    });

    it('returns error when offer is expired', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([{
        id: 'offer-1',
        listingId: 'listing-1',
        sellerId: 'seller-1',
        discountedPriceCents: 8000,
        expiresAt: expiredDate,
      }]);
      mockDb.select.mockReturnValueOnce(selectChain);

      const { acceptWatcherOffer } = await import('../watcher-offers');
      const result = await acceptWatcherOffer({
        watcherOfferId: 'offer-1',
        shippingAddressId: 'addr-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('This offer has expired');
    });
  });

  describe('cancelWatcherOffer', () => {
    it('exports cancelWatcherOffer function', async () => {
      const mod = await import('../watcher-offers');
      expect(typeof mod.cancelWatcherOffer).toBe('function');
    });

    it('returns error when offer not found', async () => {
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([]); // No offer found
      mockDb.select.mockReturnValueOnce(selectChain);

      const { cancelWatcherOffer } = await import('../watcher-offers');
      const result = await cancelWatcherOffer('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Watcher offer not found');
    });

    it('returns error when seller does not own offer', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([{
        id: 'offer-1',
        sellerId: 'other-seller',
        expiresAt: futureDate,
      }]);
      mockDb.select.mockReturnValueOnce(selectChain);

      const { cancelWatcherOffer } = await import('../watcher-offers');
      const result = await cancelWatcherOffer('offer-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You do not own this offer');
    });

    it('returns error when offer already expired', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      const selectChain = createMockChain();
      selectChain.limit.mockResolvedValueOnce([{
        id: 'offer-1',
        sellerId: 'seller-1',
        expiresAt: expiredDate,
      }]);
      mockDb.select.mockReturnValueOnce(selectChain);

      const { cancelWatcherOffer } = await import('../watcher-offers');
      const result = await cancelWatcherOffer('offer-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This offer has already expired');
    });
  });
});
