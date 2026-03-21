import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, conditions: Record<string, unknown>) => ({
    ...conditions,
    __caslSubjectType__: type,
  })),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));
vi.mock('@twicely/utils/format', () => ({
  formatPrice: (c: number) => `$${(c / 100).toFixed(2)}`,
}));

import { respondToShippingQuote } from '../shipping-quote';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);

function makeAbility(canResult: boolean) {
  return { can: vi.fn().mockReturnValue(canResult) };
}

const SELLER_ID = 'seller-test-001';
const BUYER_ID = 'buyer-test-001';
const QUOTE_ID = 'quote-test-001';
const ORDER_ID = 'order-test-001';

const baseQuote = {
  id: QUOTE_ID,
  orderId: ORDER_ID,
  sellerId: SELLER_ID,
  buyerId: BUYER_ID,
  status: 'PENDING_BUYER',
  maxShippingCents: 1000,
  quotedShippingCents: 700,
  penaltyApplied: false,
  penaltyDiscountPercent: 25,
  finalShippingCents: null,
  savingsCents: null,
  sellerDeadline: new Date(Date.now() + 3600000),
  sellerQuotedAt: new Date(),
  buyerRespondedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function mockSelectChain(data: unknown) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
  };
  mockSelect.mockReturnValueOnce(chain as never);
  return chain;
}

function mockUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  mockUpdate.mockReturnValueOnce(chain as never);
  return chain;
}

describe('respondToShippingQuote — ACCEPT happy path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets quote status to ACCEPTED', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    expect(quoteUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACCEPTED' })
    );
  });

  it('uses quotedShippingCents as finalShippingCents', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]); // quotedShippingCents = 700
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    expect(quoteUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ finalShippingCents: 700 })
    );
  });

  it('computes savingsCents = maxShippingCents - finalShippingCents', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]); // max=1000, quoted=700
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    // savingsCents = 1000 - 700 = 300
    expect(quoteUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ savingsCents: 300 })
    );
  });

  it('updates order shippingCents and totalCents', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    const orderUpdate = mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    // totalCents = 5000 + 700 + 0 - 0 = 5700
    expect(orderUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCents: 700, totalCents: 5700 })
    );
  });

  it('includes tax and discount in order total', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 300, discountCents: 100 }]);
    const orderUpdate = mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    // totalCents = 5000 + 700 + 300 - 100 = 5900
    expect(orderUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: 5900 })
    );
  });

  it('falls back to maxShippingCents when quotedShippingCents is null', async () => {
    const nullQuote = { ...baseQuote, quotedShippingCents: null };
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([nullQuote]);
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    // Falls back to maxShippingCents = 1000, savings = 0
    expect(quoteUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ finalShippingCents: 1000, savingsCents: 0 })
    );
  });

  it('records buyerRespondedAt timestamp on accept', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });

    const setCall = quoteUpdate.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.buyerRespondedAt).toBeInstanceOf(Date);
  });
});

describe('respondToShippingQuote — DISPUTE path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets quote status to DISPUTED', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ orderNumber: 'ORD-001' }]);

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'DISPUTE' });

    expect(result.success).toBe(true);
    expect(quoteUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DISPUTED' })
    );
  });

  it('does NOT update order totals on dispute (no second update call)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockUpdateChain();
    mockSelectChain([{ orderNumber: 'ORD-001' }]);

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'DISPUTE' });

    // Only 1 update call (quote), not a second one (order)
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('records buyerRespondedAt timestamp on dispute', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    const quoteUpdate = mockUpdateChain();
    mockSelectChain([{ orderNumber: 'ORD-001' }]);

    await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'DISPUTE' });

    const setCall = quoteUpdate.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.buyerRespondedAt).toBeInstanceOf(Date);
  });

});

