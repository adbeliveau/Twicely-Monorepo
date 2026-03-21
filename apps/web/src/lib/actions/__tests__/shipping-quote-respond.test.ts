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

describe('respondToShippingQuote — Zod validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing quoteId', async () => {
    const result = await respondToShippingQuote({ action: 'ACCEPT' });
    expect(result.success).toBe(false);
  });

  it('rejects missing action', async () => {
    const result = await respondToShippingQuote({ quoteId: QUOTE_ID });
    expect(result.success).toBe(false);
  });

  it('rejects invalid action value', async () => {
    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'IGNORE' });
    expect(result.success).toBe(false);
  });

  it('rejects empty quoteId', async () => {
    const result = await respondToShippingQuote({ quoteId: '', action: 'ACCEPT' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict schema)', async () => {
    const result = await respondToShippingQuote({
      quoteId: QUOTE_ID,
      action: 'ACCEPT',
      extraField: 'hacked',
    });
    expect(result.success).toBe(false);
  });

  it('accepts DISPUTE as a valid action value', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockUpdateChain();
    mockSelectChain([{ orderNumber: 'ORD-001' }]);

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'DISPUTE' });
    expect(result.success).toBe(true);
  });
});

describe('respondToShippingQuote — auth and authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: makeAbility(false) as never,
    });

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects seller trying to respond (CASL denies)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID } as never,
      ability: makeAbility(false) as never,
    });

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('rejects buyer responding to a quote belonging to another buyer', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'other-buyer-xyz' } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('allows the authorized buyer to accept', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockUpdateChain();
    mockSelectChain([{ itemSubtotalCents: 5000, taxCents: 0, discountCents: 0 }]);
    mockUpdateChain();

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });
    expect(result.success).toBe(true);
  });
});

describe('respondToShippingQuote — state guards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when status is PENDING_SELLER (seller turn, not buyer)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([{ ...baseQuote, status: 'PENDING_SELLER' }]);

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not awaiting');
  });

  it('rejects when quote already ACCEPTED', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([{ ...baseQuote, status: 'ACCEPTED' }]);

    const result = await respondToShippingQuote({ quoteId: QUOTE_ID, action: 'ACCEPT' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not awaiting');
  });

  it('rejects when quote not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([]);

    const result = await respondToShippingQuote({ quoteId: 'nonexistent', action: 'ACCEPT' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
