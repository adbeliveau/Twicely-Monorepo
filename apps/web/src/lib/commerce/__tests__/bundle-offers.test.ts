import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Set up hoisted mocks using factory functions that return objects
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
      capture: vi.fn(),
      cancel: vi.fn(),
    },
  },
}));

vi.mock('@twicely/jobs/offer-expiry', () => ({
  scheduleOfferExpiry: vi.fn(),
  cancelOfferExpiry: vi.fn(),
}));

vi.mock('../offer-notifications', () => ({
  notifyOfferEvent: vi.fn(),
}));

vi.mock('../offer-to-order', () => ({
  createOrderFromOffer: vi.fn(),
}));

vi.mock('../offer-queries', () => ({
  getOfferById: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

// Import after mocks
import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';
import { scheduleOfferExpiry, cancelOfferExpiry } from '@twicely/jobs/offer-expiry';
import { createOrderFromOffer } from '../offer-to-order';
import { getOfferById } from '../offer-queries';
import { createBundleOffer, respondToBundleOffer, getBundleOfferDetails } from '../bundle-offers';

// Type the mocked db - use unknown cast to avoid type mismatch
const mockDb = db as unknown as {
  select: Mock;
  insert: Mock;
  update: Mock;
  transaction: Mock;
};

// Type mocked stripe
const mockStripe = stripe as unknown as {
  paymentIntents: {
    create: Mock;
    capture: Mock;
    cancel: Mock;
  };
};

// Type other mocks
const mockCreateOrderFromOffer = createOrderFromOffer as Mock;
const mockGetOfferById = getOfferById as Mock;

// Suppress unused import warnings (used by vi.mock but not directly referenced)
void scheduleOfferExpiry;
void cancelOfferExpiry;

// Create chainable mock helpers
const createSelectChain = (rows: unknown[], withLimit = false) => ({
  from: vi.fn(() => ({
    where: withLimit
      ? vi.fn(() => ({ limit: vi.fn(() => rows) }))
      : vi.fn(() => rows),
    innerJoin: vi.fn(() => ({
      where: vi.fn(() => rows),
    })),
  })),
});

describe('Bundle Offers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_bundle_123' });
    mockStripe.paymentIntents.capture.mockResolvedValue({ id: 'pi_bundle_123', status: 'succeeded' });
    mockStripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_bundle_123', status: 'canceled' });
    mockCreateOrderFromOffer.mockResolvedValue({ success: true, orderId: 'order_123' });
  });

  describe('createBundleOffer validation', () => {
    it('rejects bundle with < 2 items', async () => {
      const result = await createBundleOffer({
        buyerId: 'b1',
        listingIds: ['l1'],
        offeredPriceCents: 5000,
        shippingAddressId: 'a1',
        paymentMethodId: 'pm_test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 2');
    });

    it('rejects bundle with > 10 items', async () => {
      const listingIds = Array.from({ length: 11 }, (_, i) => `l${i}`);
      const result = await createBundleOffer({
        buyerId: 'b1',
        listingIds,
        offeredPriceCents: 50000,
        shippingAddressId: 'a1',
        paymentMethodId: 'pm_test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed 10');
    });

    it('rejects offer on own listings', async () => {
      // Mock listings owned by the buyer (s1)
      const listings = [
        { id: 'l1', ownerUserId: 's1', status: 'ACTIVE', priceCents: 5000 },
        { id: 'l2', ownerUserId: 's1', status: 'ACTIVE', priceCents: 3000 },
      ];

      mockDb.select.mockReturnValueOnce(createSelectChain(listings, false));

      const result = await createBundleOffer({
        buyerId: 's1', // Same as owner
        listingIds: ['l1', 'l2'],
        offeredPriceCents: 5000,
        shippingAddressId: 'a1',
        paymentMethodId: 'pm_test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('own listings');
    });

    it('rejects bundle with mixed sellers', async () => {
      const listings = [
        { id: 'l1', ownerUserId: 's1', status: 'ACTIVE', priceCents: 5000 },
        { id: 'l2', ownerUserId: 's2', status: 'ACTIVE', priceCents: 3000 },
      ];

      mockDb.select.mockReturnValueOnce(createSelectChain(listings, false));

      const result = await createBundleOffer({
        buyerId: 'b1',
        listingIds: ['l1', 'l2'],
        offeredPriceCents: 7000,
        shippingAddressId: 'a1',
        paymentMethodId: 'pm_test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('same seller');
    });

    it('rejects bundle price > sum of individual prices', async () => {
      const listings = [
        { id: 'l1', ownerUserId: 's1', status: 'ACTIVE', priceCents: 5000 },
        { id: 'l2', ownerUserId: 's1', status: 'ACTIVE', priceCents: 3000 },
      ];
      const addressRow = [{ id: 'a1', userId: 'b1' }];

      mockDb.select
        .mockReturnValueOnce(createSelectChain(listings, false))
        .mockReturnValueOnce(createSelectChain(addressRow, true));

      const result = await createBundleOffer({
        buyerId: 'b1',
        listingIds: ['l1', 'l2'],
        offeredPriceCents: 9000, // More than 5000 + 3000
        shippingAddressId: 'a1',
        paymentMethodId: 'pm_test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });
  });

  describe('respondToBundleOffer validation', () => {
    it('rejects if offer not found', async () => {
      mockGetOfferById.mockResolvedValue(null);

      const result = await respondToBundleOffer('s1', 'o1', 'accept');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('rejects if not a bundle offer', async () => {
      mockGetOfferById.mockResolvedValue({
        id: 'o1',
        type: 'BEST_OFFER',
        status: 'PENDING',
        sellerId: 's1',
      });

      const result = await respondToBundleOffer('s1', 'o1', 'accept');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a bundle');
    });

    it('rejects if offer not pending', async () => {
      mockGetOfferById.mockResolvedValue({
        id: 'o1',
        type: 'BUNDLE',
        status: 'ACCEPTED',
        sellerId: 's1',
      });

      const result = await respondToBundleOffer('s1', 'o1', 'accept');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no longer pending');
    });

    it('rejects if not the seller', async () => {
      mockGetOfferById.mockResolvedValue({
        id: 'o1',
        type: 'BUNDLE',
        status: 'PENDING',
        sellerId: 's1',
      });

      const result = await respondToBundleOffer('s2', 'o1', 'accept');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot respond');
    });

    // Note: Counter price validation happens after bundle item lookup,
    // which requires complex mock setup. Tested via integration tests.
    it.todo('rejects counter without price');
  });

  describe('getBundleOfferDetails', () => {
    it('returns null if offer not found', async () => {
      mockGetOfferById.mockResolvedValue(null);

      const result = await getBundleOfferDetails('o1');

      expect(result).toBeNull();
    });

    it('returns null for non-bundle offer', async () => {
      mockGetOfferById.mockResolvedValue({
        id: 'o1',
        type: 'BEST_OFFER',
      });

      const result = await getBundleOfferDetails('o1');

      expect(result).toBeNull();
    });
  });
});
