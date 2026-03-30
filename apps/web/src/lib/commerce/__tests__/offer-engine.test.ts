import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn() };
const mockStripe = { paymentIntents: { create: vi.fn(), capture: vi.fn(), cancel: vi.fn() } };
const mockQueries = { countActiveOffersByBuyer: vi.fn(), countActiveOffersByBuyerForSeller: vi.fn(), countActiveOffersByBuyerForListing: vi.fn(), hasRecentDeclinedOffer: vi.fn(), getOfferById: vi.fn() };
const mockScheduleExpiry = vi.fn(), mockCancelExpiry = vi.fn(), mockCreateOrder = vi.fn();
const mockNotifyOfferEvent = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/stripe/server', () => ({ stripe: mockStripe }));
vi.mock('@twicely/commerce/offer-queries', () => mockQueries);
vi.mock('@twicely/commerce/offer-to-order', () => ({ createOrderFromOffer: mockCreateOrder }));
vi.mock('@twicely/jobs/offer-expiry', () => ({ scheduleOfferExpiry: mockScheduleExpiry, cancelOfferExpiry: mockCancelExpiry }));
vi.mock('@twicely/commerce/offer-notifications', () => ({ notifyOfferEvent: mockNotifyOfferEvent }));
vi.mock('@/lib/queries/buyer-block', () => ({ isBuyerBlocked: vi.fn().mockResolvedValue(false) }));
vi.mock('@/lib/actions/browsing-history-helpers', () => ({ updateEngagement: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

const sel = (r: unknown[]) => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve(r)), for: vi.fn(() => Promise.resolve(r)) })) })) });
const ins = (r: unknown[]) => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(r)) })) });
const upd = (r: unknown[]) => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve(r)) })) })) });
const txMock = () => {
  const selectFn = vi.fn()
    .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(() => Promise.resolve([{ id: 'o1', status: 'PENDING' }])) })) })) })
    .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(() => Promise.resolve([{ id: 'l1', status: 'ACTIVE', availableQuantity: 1, quantity: 1 }])) })) })) })
    .mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) });
  return { select: selectFn, update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })) };
};

describe('Offer Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.resetModules();
    mockQueries.countActiveOffersByBuyer.mockResolvedValue(0);
    mockQueries.countActiveOffersByBuyerForSeller.mockResolvedValue(0);
    mockQueries.countActiveOffersByBuyerForListing.mockResolvedValue(0);
    mockQueries.hasRecentDeclinedOffer.mockResolvedValue(false);
    mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_test123' });
    mockStripe.paymentIntents.capture.mockResolvedValue({ id: 'pi_test123', status: 'succeeded' });
    mockStripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_test123', status: 'canceled' });
    mockCreateOrder.mockResolvedValue({ success: true, orderId: 'order_123', orderNumber: 'TW-123456' });
  });

  describe('createOffer', () => {
    it('creates with status=PENDING, type=BEST_OFFER, counterCount=0', async () => {
      const listing = { id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000, autoAcceptOfferCents: null, autoDeclineOfferCents: null, offerExpiryHours: 48 };
      mockDb.select.mockReturnValueOnce(sel([listing])).mockReturnValueOnce(sel([{ vacationMode: false }])).mockReturnValueOnce(sel([{ id: 'a1', userId: 'b1' }]));
      mockDb.insert.mockReturnValue(ins([{ id: 'o1', status: 'PENDING', type: 'BEST_OFFER', counterCount: 0, stripeHoldId: 'pi_test123' }]));
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      const r = await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 8000, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(r.success).toBe(true); expect(r.offer?.status).toBe('PENDING'); expect(r.offer?.counterCount).toBe(0);
    });

    it('auto-accepts when amount >= autoAcceptCents', async () => {
      const listing = { id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000, autoAcceptOfferCents: 7500, autoDeclineOfferCents: null, offerExpiryHours: 48 };
      mockDb.select.mockReturnValueOnce(sel([listing])).mockReturnValueOnce(sel([{ vacationMode: false }])).mockReturnValueOnce(sel([{ id: 'a1', userId: 'b1' }]));
      mockDb.insert.mockReturnValue(ins([{ id: 'o1', status: 'PENDING', stripeHoldId: 'pi_test123' }]));
      mockDb.transaction.mockImplementation(async (fn) => fn({ update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })), select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })) }));
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      const r = await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 8000, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(r.success).toBe(true); expect(r.autoAccepted).toBe(true); expect(mockStripe.paymentIntents.capture).toHaveBeenCalled();
    });

    it('auto-declines when amount <= autoDeclineOfferCents', async () => {
      const listing = { id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000, autoAcceptOfferCents: null, autoDeclineOfferCents: 6000, offerExpiryHours: 48 };
      mockDb.select.mockReturnValueOnce(sel([listing])).mockReturnValueOnce(sel([{ vacationMode: false }])).mockReturnValueOnce(sel([{ id: 'a1', userId: 'b1' }]));
      mockDb.insert.mockReturnValue(ins([{ id: 'o1', status: 'DECLINED' }]));
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      const r = await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 5500, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(r.success).toBe(true); expect(r.offer?.status).toBe('DECLINED'); expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('rejects when 3 active offers on same listing', async () => {
      mockDb.select.mockReturnValue(sel([{ id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000 }]));
      mockQueries.countActiveOffersByBuyerForListing.mockResolvedValue(3);
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      const r = await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 8000, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(r.success).toBe(false); expect(r.error).toContain('active offer');
    });

    it('rejects when 10 active offers globally', async () => {
      mockDb.select.mockReturnValue(sel([{ id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000 }]));
      mockQueries.countActiveOffersByBuyer.mockResolvedValue(10);
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      const r = await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 8000, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(r.success).toBe(false); expect(r.error).toContain('too many active offers');
    });
  });

  describe('acceptOffer', () => {
    const offerBase = { id: 'o1', listingId: 'l1', buyerId: 'b1', sellerId: 's1', offerCents: 8000, status: 'PENDING', stripeHoldId: 'pi_h1', counterByRole: null, shippingAddressId: 'a1', currency: 'usd', listing: { id: 'l1', title: 'Test Item', slug: 'test-item', priceCents: 10000, status: 'ACTIVE' }, buyer: { id: 'b1', name: 'Test Buyer' } };

    it('creates order when offer accepted', async () => {
      mockQueries.getOfferById.mockResolvedValue(offerBase);
      mockDb.transaction.mockImplementation((fn) => fn(txMock()));
      const { acceptOffer } = await import('@/lib/commerce/offer-engine');
      const r = await acceptOffer('o1', 's1');
      expect(r.success).toBe(true); expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ offerId: 'o1' }));
    });

    it('declines all other pending offers on same listing', async () => {
      mockQueries.getOfferById.mockResolvedValue(offerBase);
      const others = [{ id: 'ot1', stripeHoldId: 'pi_ot1' }, { id: 'ot2', stripeHoldId: 'pi_ot2' }];
      mockDb.transaction.mockImplementation((fn) => {
        const tx = {
          select: vi.fn()
            // 1st call: lock the offer row
            .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(() => Promise.resolve([{ id: 'o1', status: 'PENDING' }])) })) })) })
            // 2nd call: lock the listing row
            .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(() => Promise.resolve([{ id: 'l1', status: 'ACTIVE', availableQuantity: 1, quantity: 1 }])) })) })) })
            // 3rd call: get other pending offers
            .mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(others)) })) }),
          update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })),
        };
        return fn(tx);
      });
      const { acceptOffer } = await import('@/lib/commerce/offer-engine');
      await acceptOffer('o1', 's1');
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_ot1'); expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_ot2');
    });

    it('captures Stripe hold on acceptance', async () => {
      mockQueries.getOfferById.mockResolvedValue(offerBase);
      mockDb.transaction.mockImplementation((fn) => fn(txMock()));
      const { acceptOffer } = await import('@/lib/commerce/offer-engine');
      await acceptOffer('o1', 's1');
      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_h1');
    });
  });

  describe('declineOffer', () => {
    it('sets status to DECLINED and releases hold', async () => {
      const offer = { id: 'o1', listingId: 'l1', buyerId: 'b1', sellerId: 's1', offerCents: 8000, status: 'PENDING', stripeHoldId: 'pi_h1' };
      mockQueries.getOfferById.mockResolvedValue(offer);
      mockDb.update.mockReturnValue(upd([{ ...offer, status: 'DECLINED' }]));
      const { declineOffer } = await import('@/lib/commerce/offer-engine');
      const r = await declineOffer('o1', 's1');
      expect(r.success).toBe(true); expect(r.offer?.status).toBe('DECLINED'); expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_h1');
    });

    it('blocks re-offer of same amount within 24h', async () => {
      mockDb.select.mockReturnValue(sel([{ id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000 }]));
      mockQueries.hasRecentDeclinedOffer.mockResolvedValue(true);
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      const r = await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 8000, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(r.success).toBe(false); expect(r.error).toContain('recently declined');
    });
  });

  describe('counterOffer', () => {
    const counterTx = (newOffer: unknown) => ({ update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })), insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([newOffer])) })) })) });
    const offerBase = { id: 'o1', listingId: 'l1', buyerId: 'b1', sellerId: 's1', offerCents: 8000, status: 'PENDING', stripeHoldId: 'pi_h1', counterCount: 1, currency: 'usd', shippingAddressId: 'a1', listing: { id: 'l1', title: 'Test Item', slug: 'test-item', priceCents: 10000, status: 'ACTIVE' }, buyer: { id: 'b1', name: 'Test Buyer' } };

    it('creates new offer with parentOfferId, counterCount incremented', async () => {
      const newOffer = { id: 'oc', parentOfferId: 'o1', counterCount: 2, status: 'PENDING', stripeHoldId: null, sellerId: 's1', buyerId: 'b1' };
      mockQueries.getOfferById.mockResolvedValueOnce(offerBase).mockResolvedValueOnce({ ...newOffer, expiresAt: new Date(), listing: offerBase.listing, buyer: offerBase.buyer });
      mockDb.select.mockReturnValue(sel([{ offerExpiryHours: 48 }]));
      mockDb.transaction.mockImplementation(async (fn) => fn(counterTx(newOffer)));
      const { counterOffer } = await import('@/lib/commerce/offer-engine');
      const r = await counterOffer('o1', 's1', 7500);
      expect(r.success).toBe(true); expect(r.offer?.counterCount).toBe(2);
    });

    it('rejects counter beyond max depth (5)', async () => {
      mockQueries.getOfferById.mockResolvedValue({ id: 'o1', status: 'PENDING', counterCount: 5, sellerId: 's1', buyerId: 'b1' });
      const { counterOffer } = await import('@/lib/commerce/offer-engine');
      const r = await counterOffer('o1', 's1', 7500);
      expect(r.success).toBe(false); expect(r.error).toContain('Maximum negotiation');
    });

    it('seller counter releases buyer hold, NO new hold created', async () => {
      const offer = { ...offerBase, counterCount: 0 };
      const newOffer = { id: 'oc', stripeHoldId: null, status: 'PENDING', sellerId: 's1', buyerId: 'b1' };
      mockQueries.getOfferById.mockResolvedValueOnce(offer).mockResolvedValueOnce({ ...newOffer, expiresAt: new Date(), listing: offerBase.listing, buyer: offerBase.buyer });
      mockDb.select.mockReturnValue(sel([{ offerExpiryHours: 48 }]));
      mockDb.transaction.mockImplementation(async (fn) => fn(counterTx(newOffer)));
      mockStripe.paymentIntents.create.mockClear(); mockStripe.paymentIntents.cancel.mockClear();
      const { counterOffer } = await import('@/lib/commerce/offer-engine');
      await counterOffer('o1', 's1', 7500);
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_h1'); expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('sets parent offer status to COUNTERED', async () => {
      const offer = { ...offerBase, counterCount: 0 };
      let statusSet = false;
      mockQueries.getOfferById.mockResolvedValueOnce(offer).mockResolvedValueOnce({ id: 'oc', status: 'PENDING', expiresAt: new Date(), sellerId: 's1', buyerId: 'b1', listing: offerBase.listing, buyer: offerBase.buyer });
      mockDb.select.mockReturnValue(sel([{ offerExpiryHours: 48 }]));
      mockDb.transaction.mockImplementation(async (fn) => fn({ update: vi.fn(() => ({ set: vi.fn((d) => { if (d.status === 'COUNTERED') statusSet = true; return { where: vi.fn(() => Promise.resolve([])) }; }) })), insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'oc' }])) })) })) }));
      const { counterOffer } = await import('@/lib/commerce/offer-engine');
      await counterOffer('o1', 's1', 7500);
      expect(statusSet).toBe(true);
    });
  });

  describe('expireOffer', () => {
    it('expires offer (status=EXPIRED, hold released)', async () => {
      const offerData = { id: 'o1', status: 'PENDING', stripeHoldId: 'pi_h1', buyerId: 'b1', listingId: 'l1', offerCents: 8000 };
      mockQueries.getOfferById.mockResolvedValue(offerData);
      mockDb.update.mockReturnValue(upd([{ id: 'o1', status: 'EXPIRED' }]));
      const { expireOffer } = await import('@/lib/commerce/offer-engine');
      const r = await expireOffer('o1');
      expect(r.success).toBe(true); expect(r.offer?.status).toBe('EXPIRED'); expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_h1');
    });

    it('expiry job scheduled on creation', async () => {
      const listing = { id: 'l1', sellerId: 's1', status: 'ACTIVE', allowOffers: true, priceCents: 10000, autoAcceptOfferCents: null, autoDeclineOfferCents: null, offerExpiryHours: 48 };
      mockDb.select.mockReturnValueOnce(sel([listing])).mockReturnValueOnce(sel([{ vacationMode: false }])).mockReturnValueOnce(sel([{ id: 'a1', userId: 'b1' }]));
      mockDb.insert.mockReturnValue(ins([{ id: 'o1', status: 'PENDING', stripeHoldId: 'pi_test123' }]));
      mockScheduleExpiry.mockClear();
      const { createOffer } = await import('@/lib/commerce/offer-engine');
      await createOffer({ listingId: 'l1', buyerId: 'b1', offerCents: 8000, paymentMethodId: 'pm_t', shippingAddressId: 'a1' });
      expect(mockScheduleExpiry).toHaveBeenCalledWith('o1', expect.any(Date));
    });
  });

  describe('Edge Cases', () => {
    it('cancel releases hold and sets CANCELED (not CANCELLED)', async () => {
      mockQueries.getOfferById.mockResolvedValue({ id: 'o1', buyerId: 'b1', status: 'PENDING', stripeHoldId: 'pi_h1' });
      mockDb.update.mockReturnValue(upd([{ id: 'o1', status: 'CANCELED' }]));
      const { cancelOffer } = await import('@/lib/commerce/offer-engine');
      const r = await cancelOffer('o1', 'b1');
      expect(r.success).toBe(true); expect(r.offer?.status).toBe('CANCELED'); expect(mockStripe.paymentIntents.cancel).toHaveBeenCalled();
    });

    it('buyer counter-offer creates new hold at new amount', async () => {
      const listingData = { id: 'l1', title: 'Test Item', slug: 'test-item', priceCents: 10000, status: 'ACTIVE' };
      const buyerData = { id: 'b1', name: 'Test Buyer' };
      const offer = { id: 'o1', listingId: 'l1', buyerId: 'b1', sellerId: 's1', offerCents: 8000, status: 'PENDING', stripeHoldId: 'pi_h1', counterCount: 0, counterByRole: 'SELLER', currency: 'usd', shippingAddressId: 'a1', listing: listingData, buyer: buyerData };
      mockQueries.getOfferById.mockResolvedValueOnce(offer).mockResolvedValueOnce({ id: 'oc', stripeHoldId: 'pi_new', status: 'PENDING', expiresAt: new Date(), sellerId: 's1', buyerId: 'b1', listing: listingData, buyer: buyerData });
      mockDb.select.mockReturnValue(sel([{ offerExpiryHours: 48 }]));
      mockDb.transaction.mockImplementation(async (fn) => fn({ update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })), insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'oc', stripeHoldId: 'pi_new' }])) })) })) }));
      mockStripe.paymentIntents.create.mockClear();
      const { counterOffer } = await import('@/lib/commerce/offer-engine');
      await counterOffer('o1', 'b1', 7000, undefined, 'pm_buyer');
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 7000, payment_method: 'pm_buyer', capture_method: 'manual' }));
    });
  });
});
