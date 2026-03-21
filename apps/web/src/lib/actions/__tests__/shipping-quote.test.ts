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
const BUYER_ID = 'buyer-test-001';
const QUOTE_ID = 'quote-test-001';
const ORDER_ID = 'order-test-001';

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

describe('submitShippingQuote — auth and authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: makeAbility(false) as never,
    });

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 500 });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects buyer trying to submit a quote (CASL denies)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: BUYER_ID, delegationId: null } as never,
      ability: makeAbility(false) as never,
    });

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('permission');
  });

  it('rejects seller submitting quote for another seller order', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'other-seller-xyz', delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('allows delegated staff with correct scope', async () => {
    mockAuthorize.mockResolvedValue({
      session: {
        userId: 'staff-test-001',
        delegationId: 'del-test-001',
        onBehalfOfSellerId: SELLER_ID,
      } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    mockUpdateChain();

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 800 });
    expect(result.success).toBe(true);
  });

  it('rejects delegated staff without required scope', async () => {
    mockAuthorize.mockResolvedValue({
      session: {
        userId: 'staff-test-001',
        delegationId: 'del-test-001',
        onBehalfOfSellerId: SELLER_ID,
      } as never,
      ability: makeAbility(false) as never,
    });

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 800 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('permission');
  });
});

describe('submitShippingQuote — Zod validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing quoteId', async () => {
    const result = await submitShippingQuote({ quotedShippingCents: 500 });
    expect(result.success).toBe(false);
  });

  it('rejects missing quotedShippingCents', async () => {
    const result = await submitShippingQuote({ quoteId: QUOTE_ID });
    expect(result.success).toBe(false);
  });

  it('rejects empty quoteId string', async () => {
    const result = await submitShippingQuote({ quoteId: '', quotedShippingCents: 500 });
    expect(result.success).toBe(false);
  });

  it('rejects negative quotedShippingCents', async () => {
    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects float quotedShippingCents (must be integer cents)', async () => {
    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 9.99 });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (strict schema)', async () => {
    const result = await submitShippingQuote({
      quoteId: QUOTE_ID,
      quotedShippingCents: 500,
      extraField: 'hacked',
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero quotedShippingCents (free shipping)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    mockUpdateChain();

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 0 });
    expect(result.success).toBe(true);
  });
});

describe('submitShippingQuote — business logic guards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects quote exceeding max shipping', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 1500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot exceed');
  });

  it('rejects quote when status is ACCEPTED', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([{ ...baseQuote, status: 'ACCEPTED' }]);

    const result = await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be updated');
  });

  it('rejects when quote not found', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([]);

    const result = await submitShippingQuote({ quoteId: 'nonexistent', quotedShippingCents: 500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('transitions PENDING_SELLER to PENDING_BUYER with correct status', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: SELLER_ID, delegationId: null } as never,
      ability: makeAbility(true) as never,
    });
    mockSelectChain([baseQuote]);
    mockSelectChain([{ orderNumber: 'ORD-001' }]);
    const updateChain = mockUpdateChain();

    await submitShippingQuote({ quoteId: QUOTE_ID, quotedShippingCents: 700 });

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING_BUYER' })
    );
  });

});

