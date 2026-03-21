import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

import { getExpiredQuotes } from '../shipping-quote';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

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
  sellerDeadline: new Date(Date.now() - 3600000), // past deadline
  sellerQuotedAt: null,
  buyerRespondedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getExpiredQuotes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns expired PENDING_SELLER quotes', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([baseQuote]),
    };
    mockSelect.mockReturnValueOnce(chain as never);

    const result = await getExpiredQuotes();

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('PENDING_SELLER');
  });

  it('returns empty array when no expired quotes', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValueOnce(chain as never);

    const result = await getExpiredQuotes();

    expect(result).toHaveLength(0);
  });

  it('returns multiple expired quotes', async () => {
    const expired1 = { ...baseQuote, id: 'q-expired-001' };
    const expired2 = { ...baseQuote, id: 'q-expired-002' };
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([expired1, expired2]),
    };
    mockSelect.mockReturnValueOnce(chain as never);

    const result = await getExpiredQuotes();

    expect(result).toHaveLength(2);
  });

  it('includes full quote data in results', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([baseQuote]),
    };
    mockSelect.mockReturnValueOnce(chain as never);

    const result = await getExpiredQuotes();

    expect(result[0]?.maxShippingCents).toBe(1000);
    expect(result[0]?.penaltyDiscountPercent).toBe(25);
    expect(result[0]?.sellerId).toBe(SELLER_ID);
  });

  it('result contains sellerDeadline for deadline-cron processing', async () => {
    const pastDeadline = new Date(Date.now() - 7200000); // 2 hours ago
    const expiredQuote = { ...baseQuote, sellerDeadline: pastDeadline };
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([expiredQuote]),
    };
    mockSelect.mockReturnValueOnce(chain as never);

    const result = await getExpiredQuotes();

    expect(result[0]?.sellerDeadline).toEqual(pastDeadline);
  });
});
