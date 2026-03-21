import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: { id: 'id', type: 'type', status: 'status', amountCents: 'amount_cents', userId: 'user_id', orderId: 'order_id' },
  order: { id: 'id', itemSubtotalCents: 'item_subtotal_cents' },
  orderPayment: { orderId: 'order_id', stripeFeesCents: 'stripe_fees_cents' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/finance/format', () => ({
  formatCentsToDollars: vi.fn((cents: number) => `$${(cents / 100).toFixed(2)}`),
}));

vi.mock('@twicely/commerce/local-reserve', () => ({
  markListingSoldForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/jobs/local-escrow-release', () => ({
  enqueueLocalEscrowRelease: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { createLocalCancelRefundLedgerEntry } from '../local-ledger';

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

describe('createLocalCancelRefundLedgerEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates REFUND_FULL ledger entry with negative amount', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 5000 }]) as never,
    );
    const insertedValues: Record<string, unknown>[] = [];
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
      }),
    } as never);

    await createLocalCancelRefundLedgerEntry('order-1', 'seller-1');

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]?.type).toBe('REFUND_FULL');
    expect(insertedValues[0]?.amountCents).toBe(-5000);
    expect(insertedValues[0]?.userId).toBe('seller-1');
    expect(insertedValues[0]?.orderId).toBe('order-1');
  });

  it('uses reasonCode with cancel-refund pattern', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 3000 }]) as never,
    );
    const insertedValues: Record<string, unknown>[] = [];
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
      }),
    } as never);

    await createLocalCancelRefundLedgerEntry('order-abc', 'seller-1');

    expect(insertedValues[0]?.reasonCode).toBe('local:order-abc:cancel-refund');
  });

  it('skips insert when order has no itemSubtotalCents', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: null }]) as never,
    );

    await createLocalCancelRefundLedgerEntry('order-1', 'seller-1');

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('skips insert when order not found', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([]) as never,
    );

    await createLocalCancelRefundLedgerEntry('order-1', 'seller-1');

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('logs info after successful creation', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 7500 }]) as never,
    );
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never);

    await createLocalCancelRefundLedgerEntry('order-1', 'seller-1');

    expect(logger.info).toHaveBeenCalledWith(
      '[local-ledger] Created cancel refund ledger entry',
      expect.objectContaining({ orderId: 'order-1', sellerId: 'seller-1', amountCents: 7500 }),
    );
  });
});
