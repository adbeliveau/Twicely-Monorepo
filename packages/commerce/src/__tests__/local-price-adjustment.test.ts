import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', status: 'status' },
  order: { id: 'id', itemSubtotalCents: 'item_subtotal_cents' },
  ledgerEntry: { id: 'id' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@twicely/commerce/local-token', () => ({
  generateTokenPair: vi.fn(),
}));

import { db } from '@twicely/db';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { generateTokenPair } from '@twicely/commerce/local-token';
import {
  validateAdjustment,
  initiatePriceAdjustment,
  acceptPriceAdjustment,
  declinePriceAdjustment,
} from '../local-price-adjustment';

function makeSelectChain(result: unknown) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain(returning: unknown[]) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(returning),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lt-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    status: 'ADJUSTMENT_PENDING', // valid source for accept/decline transitions
    scheduledAt: new Date(Date.now() + 3600_000),
    adjustedPriceCents: 7000,
    ...overrides,
  };
}


describe('validateAdjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid for a price within the max discount range', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    // 33% of 10000 = 3300, floor = 6700; adjusted = 7000 is above floor
    const result = await validateAdjustment('order-1', 'lt-1', 7000);

    expect(result.valid).toBe(true);
    expect(result.maxAdjustmentPercent).toBe(33);
  });

  it('rejects when adjusted price equals original price', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    const result = await validateAdjustment('order-1', 'lt-1', 10000);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/less than the original/i);
  });

  it('rejects when adjusted price exceeds original price', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    const result = await validateAdjustment('order-1', 'lt-1', 12000);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/less than the original/i);
  });

  it('rejects when adjusted price is 0', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    const result = await validateAdjustment('order-1', 'lt-1', 0);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/at least/i);
  });

  it('rejects when price reduction exceeds max discount percent', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    // Max 33% discount on 10000 = 3300, floor = 6700; adjusted = 6000 is below floor
    const result = await validateAdjustment('order-1', 'lt-1', 6000);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/33%/);
  });

  it('reads max adjustment percent from platform_settings', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(20);

    // Max 20% discount on 10000 = 2000, floor = 8000; adjusted = 7500 is below floor
    const result = await validateAdjustment('order-1', 'lt-1', 7500);

    expect(result.valid).toBe(false);
    expect(getPlatformSetting).toHaveBeenCalledWith(
      'commerce.local.maxAdjustmentPercent',
      33,
    );
  });

  it('accepts price exactly at the floor (boundary)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ itemSubtotalCents: 10000 }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    // floor = 10000 - floor(10000*33/100) = 10000 - 3300 = 6700
    const result = await validateAdjustment('order-1', 'lt-1', 6700);

    expect(result.valid).toBe(true);
  });

  it('rejects when order not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(33);

    const result = await validateAdjustment('order-1', 'lt-1', 5000);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Order not found');
  });
});


describe('initiatePriceAdjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates adjustedPriceCents, reason, initiatedAt and sets ADJUSTMENT_PENDING', async () => {
    // SELECT returns tx with BOTH_CHECKED_IN status (valid source)
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ id: 'lt-1', status: 'BOTH_CHECKED_IN' }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);

    const result = await initiatePriceAdjustment('lt-1', 7000, 'Flaw found on the seam');

    expect(result.success).toBe(true);
    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('ADJUSTMENT_PENDING');
    expect(setArgs.adjustedPriceCents).toBe(7000);
    expect(setArgs.adjustmentReason).toBe('Flaw found on the seam');
    expect(setArgs.adjustmentInitiatedAt).toBeInstanceOf(Date);
  });

  it('returns error when transaction not found (SELECT returns empty)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await initiatePriceAdjustment('lt-missing', 7000, 'reason');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });

  it('rejects initiate when status is SCHEDULED (invalid transition)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ id: 'lt-1', status: 'SCHEDULED' }]) as never);

    const result = await initiatePriceAdjustment('lt-1', 7000, 'reason');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from SCHEDULED to ADJUSTMENT_PENDING/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('rejects initiate when status is ADJUSTMENT_PENDING (already pending)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ id: 'lt-1', status: 'ADJUSTMENT_PENDING' }]) as never);

    const result = await initiatePriceAdjustment('lt-1', 7000, 'reason');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from ADJUSTMENT_PENDING to ADJUSTMENT_PENDING/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });
});


describe('acceptPriceAdjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates new dual tokens on acceptance', async () => {
    vi.mocked(generateTokenPair).mockReturnValue({
      sellerToken: 'new-seller-token',
      buyerToken: 'new-buyer-token',
      sellerOfflineCode: '456789',
      buyerOfflineCode: '987654',
      sellerNonce: 'nonce-s',
      buyerNonce: 'nonce-b',
    });
    // First select: fetch transaction
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(48);

    const result = await acceptPriceAdjustment('lt-1');

    expect(result.success).toBe(true);
    expect(result.sellerToken).toBe('new-seller-token');
    expect(result.buyerToken).toBe('new-buyer-token');
    expect(result.sellerOfflineCode).toBe('456789');
    expect(result.buyerOfflineCode).toBe('987654');
  });

  it('overwrites all 4 token columns in DB', async () => {
    vi.mocked(generateTokenPair).mockReturnValue({
      sellerToken: 'new-seller-token',
      buyerToken: 'new-buyer-token',
      sellerOfflineCode: '456789',
      buyerOfflineCode: '987654',
      sellerNonce: 'nonce-s',
      buyerNonce: 'nonce-b',
    });
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(48);

    await acceptPriceAdjustment('lt-1');

    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.sellerConfirmationCode).toBe('new-seller-token');
    expect(setArgs.buyerConfirmationCode).toBe('new-buyer-token');
    expect(setArgs.sellerOfflineCode).toBe('456789');
    expect(setArgs.buyerOfflineCode).toBe('987654');
  });

  it('sets acceptedAt timestamp', async () => {
    vi.mocked(generateTokenPair).mockReturnValue({
      sellerToken: 'token',
      buyerToken: 'token2',
      sellerOfflineCode: '123456',
      buyerOfflineCode: '654321',
      sellerNonce: 'n1',
      buyerNonce: 'n2',
    });
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(48);

    await acceptPriceAdjustment('lt-1');

    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.adjustmentAcceptedAt).toBeInstanceOf(Date);
  });

  it('returns status BOTH_CHECKED_IN', async () => {
    vi.mocked(generateTokenPair).mockReturnValue({
      sellerToken: 'token',
      buyerToken: 'token2',
      sellerOfflineCode: '123456',
      buyerOfflineCode: '654321',
      sellerNonce: 'n1',
      buyerNonce: 'n2',
    });
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(48);

    await acceptPriceAdjustment('lt-1');

    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('BOTH_CHECKED_IN');
  });

  it('returns error when transaction not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await acceptPriceAdjustment('lt-missing');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });

  it('rejects accept when status is COMPLETED (terminal — no transitions allowed)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([makeTransaction({ status: 'COMPLETED' })]) as never,
    );

    const result = await acceptPriceAdjustment('lt-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from COMPLETED to BOTH_CHECKED_IN/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('rejects accept when status is CANCELED (terminal — no transitions allowed)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([makeTransaction({ status: 'CANCELED' })]) as never,
    );

    const result = await acceptPriceAdjustment('lt-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from CANCELED to BOTH_CHECKED_IN/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });
});


describe('declinePriceAdjustment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets declinedAt timestamp', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);

    await declinePriceAdjustment('lt-1');

    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.adjustmentDeclinedAt).toBeInstanceOf(Date);
  });

  it('clears adjustedPriceCents to null', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);

    await declinePriceAdjustment('lt-1');

    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.adjustedPriceCents).toBeNull();
  });

  it('returns status BOTH_CHECKED_IN', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([makeTransaction()]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain([{ id: 'lt-1' }]) as never);

    await declinePriceAdjustment('lt-1');

    const updateChain = vi.mocked(db.update).mock.results[0]?.value as ReturnType<typeof makeUpdateChain>;
    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.status).toBe('BOTH_CHECKED_IN');
  });

  it('returns error when transaction not found (SELECT returns empty)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await declinePriceAdjustment('lt-missing');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });

  it('rejects decline when status is COMPLETED (terminal — no transitions allowed)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([makeTransaction({ status: 'COMPLETED' })]) as never,
    );

    const result = await declinePriceAdjustment('lt-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from COMPLETED to BOTH_CHECKED_IN/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('rejects decline when status is CANCELED (terminal — no transitions allowed)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([makeTransaction({ status: 'CANCELED' })]) as never,
    );

    const result = await declinePriceAdjustment('lt-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from CANCELED to BOTH_CHECKED_IN/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });
});
