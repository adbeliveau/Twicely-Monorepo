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
  validateAdjustment,
  initiatePriceAdjustment,
} from '@twicely/commerce/local-price-adjustment';
import { canTransition } from '@twicely/commerce/local-state-machine';
import { initiatePriceAdjustmentAction } from '../local-price-adjustment';

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
    status: 'BOTH_CHECKED_IN',
    adjustmentInitiatedAt: null,
    adjustedPriceCents: null,
    adjustmentReason: null,
    confirmationCode: 'old-code',
    offlineCode: '111111',
    ...overrides,
  };
}

const SELLER_ID = 'seller-1';
const BUYER_ID = 'buyer-1';

// ─── initiatePriceAdjustmentAction ───────────────────────────────────────────

describe('initiatePriceAdjustmentAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seller can initiate from BOTH_CHECKED_IN', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-1' }]) as never);
    vi.mocked(canTransition).mockReturnValue(true);
    vi.mocked(validateAdjustment).mockResolvedValue({ valid: true, maxAdjustmentPercent: 33 });
    vi.mocked(initiatePriceAdjustment).mockResolvedValue({ success: true });

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'Scuff on the heel',
    });

    expect(result.success).toBe(true);
    expect(initiatePriceAdjustment).toHaveBeenCalledWith('lt-1', 7000, 'Scuff on the heel');
  });

  it('rejects unauthenticated user', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: null, ability: makeAbility() } as never);

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects buyer attempting to initiate', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(BUYER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never);

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects non-participant user', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession('stranger-user'), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never);

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects when transaction not found', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-missing',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects wrong status (not BOTH_CHECKED_IN)', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([makeTransaction({ status: 'SCHEDULED' })]) as never);

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not in valid state');
  });

  it('rejects when adjustment already initiated', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([makeTransaction({ adjustmentInitiatedAt: new Date() })]) as never
    );

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already been initiated/i);
  });

  it('rejects invalid price (validateAdjustment fails)', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeTransaction()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-1' }]) as never);
    vi.mocked(canTransition).mockReturnValue(true);
    vi.mocked(validateAdjustment).mockResolvedValue({ valid: false, error: 'Exceeds max discount' });

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 1000,
      adjustmentReason: 'reason',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Exceeds max discount');
  });

  it('rejects missing reason (schema validation)', async () => {
    vi.mocked(authorize).mockResolvedValue({ session: makeSession(SELLER_ID), ability: makeAbility() } as never);

    const result = await initiatePriceAdjustmentAction({
      localTransactionId: 'lt-1',
      adjustedPriceCents: 7000,
      adjustmentReason: '',
    });

    expect(result.success).toBe(false);
  });
});
