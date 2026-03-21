import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/commerce/local-price-adjustment', () => ({
  validateAdjustment: vi.fn(),
  initiatePriceAdjustment: vi.fn(),
  acceptPriceAdjustment: vi.fn(),
  declinePriceAdjustment: vi.fn(),
}));

vi.mock('@twicely/commerce/local-ledger', () => ({
  createPriceAdjustmentLedgerEntry: vi.fn(),
}));

vi.mock('@twicely/commerce/local-state-machine', () => ({
  canTransition: vi.fn(),
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    refunds: { create: vi.fn().mockResolvedValue({ id: 'ref_test' }) },
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import {
  acceptPriceAdjustment,
  declinePriceAdjustment,
} from '@twicely/commerce/local-price-adjustment';
import { createPriceAdjustmentLedgerEntry } from '@twicely/commerce/local-ledger';
import { respondToAdjustmentAction } from '../local-price-adjustment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}

function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lt-1',
    orderId: 'order-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    status: 'ADJUSTMENT_PENDING',
    adjustmentInitiatedAt: new Date(),
    adjustedPriceCents: 7000,
    adjustmentReason: 'Flaw',
    sellerConfirmationCode: 'old-seller-token',
    buyerConfirmationCode: 'old-buyer-token',
    sellerOfflineCode: '111111',
    buyerOfflineCode: '222222',
    ...overrides,
  };
}

const SELLER_ID = 'seller-1';
const BUYER_ID = 'buyer-1';

// ─── respondToAdjustmentAction ────────────────────────────────────────────────

describe('respondToAdjustmentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buyer can accept a pending adjustment', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(acceptPriceAdjustment).mockResolvedValue({
      success: true,
      sellerToken: 'new-seller-token',
      buyerToken: 'new-buyer-token',
      sellerOfflineCode: '654321',
      buyerOfflineCode: '123456',
    });
    vi.mocked(createPriceAdjustmentLedgerEntry).mockResolvedValue(undefined);

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: true,
    });

    expect(result.success).toBe(true);
    expect(result.sellerToken).toBe('new-seller-token');
    expect(result.sellerOfflineCode).toBe('654321');
    expect(createPriceAdjustmentLedgerEntry).toHaveBeenCalledWith({
      orderId: 'order-1',
      sellerId: SELLER_ID,
      originalPriceCents: 10000,
      adjustedPriceCents: 7000,
    });
  });

  it('accept returns new codes', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeTransaction({ adjustedPriceCents: 8000 })]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(acceptPriceAdjustment).mockResolvedValue({
      success: true,
      sellerToken: 'fresh-seller-token',
      buyerToken: 'fresh-buyer-token',
      sellerOfflineCode: '987654',
      buyerOfflineCode: '456789',
    });
    vi.mocked(createPriceAdjustmentLedgerEntry).mockResolvedValue(undefined);

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: true,
    });

    expect(result.sellerToken).toBe('fresh-seller-token');
    expect(result.sellerOfflineCode).toBe('987654');
  });

  it('creates ledger entry on accept', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(acceptPriceAdjustment).mockResolvedValue({
      success: true,
      sellerToken: 'seller-token-code',
      buyerToken: 'buyer-token-code',
      sellerOfflineCode: '999999',
      buyerOfflineCode: '111111',
    });
    vi.mocked(createPriceAdjustmentLedgerEntry).mockResolvedValue(undefined);

    await respondToAdjustmentAction({ localTransactionId: 'lt-1', accept: true });

    expect(createPriceAdjustmentLedgerEntry).toHaveBeenCalledTimes(1);
  });

  it('buyer can decline a pending adjustment', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(declinePriceAdjustment).mockResolvedValue({ success: true });

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: false,
    });

    expect(result.success).toBe(true);
    expect(declinePriceAdjustment).toHaveBeenCalledWith('lt-1');
  });

  it('rejects unauthenticated user', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: null, ability: makeAbility() } as never);

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects seller attempting to respond', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never);

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects wrong status (not ADJUSTMENT_PENDING)', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction({
      status: 'BOTH_CHECKED_IN',
    })]) as never);

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not in valid state');
  });

  it('rejects when CASL denies update', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility(false) } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never);

    const result = await respondToAdjustmentAction({
      localTransactionId: 'lt-1',
      accept: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});
