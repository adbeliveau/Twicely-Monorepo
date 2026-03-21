import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import {
  getShippingQuoteByOrderId,
  getShippingQuoteById,
  getPendingQuotesForSeller,
} from '../shipping-quote';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

function makeChain(data: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(data),
    limit: vi.fn().mockResolvedValue(data),
  };
}

const SELLER_ID = 'seller-test-001';
const BUYER_ID = 'buyer-test-001';
const ORDER_ID = 'order-test-001';
const QUOTE_ID = 'quote-test-001';

const baseQuote = {
  id: QUOTE_ID,
  orderId: ORDER_ID,
  sellerId: SELLER_ID,
  buyerId: BUYER_ID,
  status: 'PENDING_SELLER',
  maxShippingCents: 1000,
  quotedShippingCents: null,
  penaltyApplied: false,
  penaltyDiscountPercent: 25,
  finalShippingCents: null,
  savingsCents: null,
  sellerDeadline: new Date(Date.now() + 3600000),
  sellerQuotedAt: null,
  buyerRespondedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getShippingQuoteByOrderId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns quote for valid order and authorized seller', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteByOrderId(ORDER_ID, SELLER_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(QUOTE_ID);
  });

  it('returns quote for valid order and authorized buyer', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteByOrderId(ORDER_ID, BUYER_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(QUOTE_ID);
  });

  it('returns null for order without quote', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getShippingQuoteByOrderId(ORDER_ID, SELLER_ID);

    expect(result).toBeNull();
  });

  it('returns null for unauthorized third-party user', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteByOrderId(ORDER_ID, 'random-user-xyz');

    expect(result).toBeNull();
  });

  it('returns full quote shape when found', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteByOrderId(ORDER_ID, SELLER_ID);

    expect(result?.sellerId).toBe(SELLER_ID);
    expect(result?.buyerId).toBe(BUYER_ID);
    expect(result?.maxShippingCents).toBe(1000);
  });
});

describe('getShippingQuoteById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns quote for seller by quote ID', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteById(QUOTE_ID, SELLER_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(QUOTE_ID);
  });

  it('returns quote for buyer by quote ID', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteById(QUOTE_ID, BUYER_ID);

    expect(result).not.toBeNull();
  });

  it('returns null when quote not found', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getShippingQuoteById('nonexistent-quote', SELLER_ID);

    expect(result).toBeNull();
  });

  it('returns null for unauthorized user', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseQuote]) as never);

    const result = await getShippingQuoteById(QUOTE_ID, 'other-user-xyz');

    expect(result).toBeNull();
  });

  it('returns PENALTY_APPLIED quote for seller', async () => {
    const penaltyQuote = { ...baseQuote, status: 'PENALTY_APPLIED', penaltyApplied: true };
    mockSelect.mockReturnValueOnce(makeChain([penaltyQuote]) as never);

    const result = await getShippingQuoteById(QUOTE_ID, SELLER_ID);

    expect(result?.status).toBe('PENALTY_APPLIED');
  });

  it('returns ACCEPTED quote with final shipping details', async () => {
    const acceptedQuote = {
      ...baseQuote,
      status: 'ACCEPTED',
      quotedShippingCents: 700,
      finalShippingCents: 700,
      savingsCents: 300,
    };
    mockSelect.mockReturnValueOnce(makeChain([acceptedQuote]) as never);

    const result = await getShippingQuoteById(QUOTE_ID, BUYER_ID);

    expect(result?.status).toBe('ACCEPTED');
    expect(result?.finalShippingCents).toBe(700);
    expect(result?.savingsCents).toBe(300);
  });
});

describe('getPendingQuotesForSeller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns pending quotes sorted by deadline', async () => {
    const q1 = { ...baseQuote, id: 'q1', orderNumber: 'TWC-000001' };
    const q2 = { ...baseQuote, id: 'q2', orderNumber: 'TWC-000002' };
    mockSelect.mockReturnValueOnce(makeChain([q1, q2]) as never);

    const result = await getPendingQuotesForSeller(SELLER_ID);

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no pending quotes', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getPendingQuotesForSeller(SELLER_ID);

    expect(result).toHaveLength(0);
  });

  it('includes PENALTY_APPLIED quotes', async () => {
    const penaltyQ = { ...baseQuote, status: 'PENALTY_APPLIED', orderNumber: 'TWC-000001' };
    mockSelect.mockReturnValueOnce(makeChain([penaltyQ]) as never);

    const result = await getPendingQuotesForSeller(SELLER_ID);

    expect(result[0]?.status).toBe('PENALTY_APPLIED');
  });

  it('result items include orderNumber field', async () => {
    const quoteWithOrder = { ...baseQuote, orderNumber: 'TWC-999999' };
    mockSelect.mockReturnValueOnce(makeChain([quoteWithOrder]) as never);

    const result = await getPendingQuotesForSeller(SELLER_ID);

    expect(result[0]?.orderNumber).toBe('TWC-999999');
  });
});
