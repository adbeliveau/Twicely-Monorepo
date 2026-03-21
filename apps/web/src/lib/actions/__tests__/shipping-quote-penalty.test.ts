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

import { submitShippingQuote } from '../shipping-quote';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);

function makeAbility(canResult: boolean) {
  return { can: vi.fn().mockReturnValue(canResult) };
}

const SELLER_ID = 'seller-test-001';
const QUOTE_ID = 'quote-test-001';
const ORDER_ID = 'order-test-001';

const basePenaltyQuote = {
  id: QUOTE_ID,
  orderId: ORDER_ID,
  sellerId: SELLER_ID,
  buyerId: 'buyer-test-001',
  status: 'PENALTY_APPLIED',
  maxShippingCents: 1000,
  quotedShippingCents: null,
  penaltyApplied: true,
  penaltyDiscountPercent: 25,
  finalShippingCents: null,
  savingsCents: null,
  sellerDeadline: new Date(Date.now() - 3600000), // already past
  sellerQuotedAt: null,
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

describe('submitShippingQuote — PENALTY_APPLIED resolution', () => {
  beforeEach(() => vi.clearAllMocks());

  it('succeeds when seller quotes after penalty is applied', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 600 });
    expect(result.success).toBe(true);
  });

  it('resolves final shipping as min(quote, penaltyPrice) when seller lower', async () => {
    // seller quotes 600, penalty = round(1000 * 0.75) = 750
    // finalShipping = min(600, 750) = 600 (buyer wins)
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    const updateChain = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 600 });

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ finalShippingCents: 600, savingsCents: 400 })
    );
  });

  it('resolves final shipping as penaltyPrice when seller quote exceeds it', async () => {
    // seller quotes 900, penalty = 750; buyer pays 750
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    const updateChain = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 900 });

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ finalShippingCents: 750, savingsCents: 250 })
    );
  });

  it('updates order totalCents after penalty resolution', async () => {
    // finalShipping = 600; total = 5000 + 600 + 100 - 0 = 5700
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 100, discountCents: 0 }]);
    const orderUpdate = mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 600 });

    expect(orderUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCents: 600, totalCents: 5700 })
    );
  });

  it('accounts for discountCents in order total recalculation', async () => {
    // 5000 + 600 + 0 - 200 = 5400
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 200 }]);
    const orderUpdate = mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 600 });

    expect(orderUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: 5400 })
    );
  });

  it('uses default 25% penalty discount when penaltyDiscountPercent is null', async () => {
    const quote = { ...basePenaltyQuote, penaltyDiscountPercent: null };
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([quote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    const updateChain = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 900 });

    // Default 25%: penaltyPrice = 750; min(900, 750) = 750
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ finalShippingCents: 750 })
    );
  });

  it('skips order update when order is not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    mockUpdateChain(); // quote update
    mockSelectChain([]); // order not found

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 600 });

    // Should still succeed — order update is conditional
    expect(result.success).toBe(true);
    // Only 1 update call (quote), no second for order
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('stores quotedShippingCents and sellerQuotedAt on penalty quote update', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([basePenaltyQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    const updateChain = mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 600 });

    const setCall = updateChain.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(setCall.quotedShippingCents).toBe(600);
    expect(setCall.sellerQuotedAt).toBeInstanceOf(Date);
  });
});
