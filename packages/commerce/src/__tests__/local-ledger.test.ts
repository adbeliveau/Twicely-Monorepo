import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DB before any imports that trigger DB connection
vi.mock('@twicely/db', () => ({
  db: {
    transaction: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/finance/format', () => ({
  formatCentsToDollars: vi.fn((cents: number) => `$${(cents / 100).toFixed(2)}`),
}));

vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: {
    id: 'id',
    type: 'type',
    status: 'status',
    amountCents: 'amount_cents',
    userId: 'user_id',
    orderId: 'order_id',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@twicely/commerce/local-reserve', () => ({
  markListingSoldForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-escrow-release', () => ({
  enqueueLocalEscrowRelease: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { createLocalTransactionLedgerEntries, createPriceAdjustmentLedgerEntry } from '../local-ledger';

function makeTxMock() {
  const insertChain = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  return {
    insert: vi.fn().mockReturnValue(insertChain),
    insertChain,
  };
}

describe('createLocalTransactionLedgerEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls db.transaction', async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = makeTxMock();
      await fn(tx as never);
    });

    await createLocalTransactionLedgerEntries({
      orderId: 'order-1',
      sellerId: 'seller-1',
      salePriceCents: 5000,
      localTfCents: 250,
      stripeFeeCents: 175,
    });

    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('inserts exactly 3 ledger entries', async () => {
    let insertCount = 0;
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(async () => {
            insertCount++;
          }),
        }),
      };
      await fn(tx as never);
    });

    await createLocalTransactionLedgerEntries({
      orderId: 'order-1',
      sellerId: 'seller-1',
      salePriceCents: 5000,
      localTfCents: 250,
      stripeFeeCents: 175,
    });

    expect(insertCount).toBe(3);
  });

  it('creates ORDER_PAYMENT_CAPTURED with positive amountCents', async () => {
    const insertedValues: Array<Record<string, unknown>> = [];

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
            insertedValues.push(vals);
          }),
        }),
      };
      await fn(tx as never);
    });

    await createLocalTransactionLedgerEntries({
      orderId: 'order-1',
      sellerId: 'seller-1',
      salePriceCents: 5000,
      localTfCents: 250,
      stripeFeeCents: 175,
    });

    const capture = insertedValues.find((v) => v.type === 'ORDER_PAYMENT_CAPTURED');
    expect(capture).toBeDefined();
    expect(capture?.amountCents).toBe(5000);
  });

  it('creates LOCAL_TRANSACTION_FEE with negative amountCents', async () => {
    const insertedValues: Array<Record<string, unknown>> = [];

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
            insertedValues.push(vals);
          }),
        }),
      };
      await fn(tx as never);
    });

    await createLocalTransactionLedgerEntries({
      orderId: 'order-1',
      sellerId: 'seller-1',
      salePriceCents: 5000,
      localTfCents: 250,
      stripeFeeCents: 175,
    });

    const fee = insertedValues.find((v) => v.type === 'LOCAL_TRANSACTION_FEE');
    expect(fee).toBeDefined();
    expect(fee?.amountCents).toBe(-250);
  });

  it('creates ORDER_STRIPE_PROCESSING_FEE with negative amountCents', async () => {
    const insertedValues: Array<Record<string, unknown>> = [];

    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
            insertedValues.push(vals);
          }),
        }),
      };
      await fn(tx as never);
    });

    await createLocalTransactionLedgerEntries({
      orderId: 'order-1',
      sellerId: 'seller-1',
      salePriceCents: 5000,
      localTfCents: 250,
      stripeFeeCents: 175,
    });

    const stripe = insertedValues.find((v) => v.type === 'ORDER_STRIPE_PROCESSING_FEE');
    expect(stripe).toBeDefined();
    expect(stripe?.amountCents).toBe(-175);
  });

  it('logs info after successful creation', async () => {
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      await fn(tx as never);
    });

    await createLocalTransactionLedgerEntries({
      orderId: 'order-1',
      sellerId: 'seller-1',
      salePriceCents: 5000,
      localTfCents: 250,
      stripeFeeCents: 175,
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[local-ledger] Created ledger entries for local transaction',
      expect.objectContaining({ orderId: 'order-1', sellerId: 'seller-1' }),
    );
  });
});

// ─── createPriceAdjustmentLedgerEntry ────────────────────────────────────────

describe('createPriceAdjustmentLedgerEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a LOCAL_PRICE_ADJUSTMENT entry with correct delta', async () => {
    const insertedValues: Record<string, unknown>[] = [];
    const insertChain = {
      values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
      }),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createPriceAdjustmentLedgerEntry({
      orderId: 'order-1',
      sellerId: 'seller-1',
      originalPriceCents: 10000,
      adjustedPriceCents: 7000,
    });

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]?.type).toBe('LOCAL_PRICE_ADJUSTMENT');
  });

  it('amountCents is negative (delta debited from seller)', async () => {
    const insertedValues: Record<string, unknown>[] = [];
    const insertChain = {
      values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
      }),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createPriceAdjustmentLedgerEntry({
      orderId: 'order-1',
      sellerId: 'seller-1',
      originalPriceCents: 10000,
      adjustedPriceCents: 7000,
    });

    // delta = 10000 - 7000 = 3000; stored as -3000
    expect(insertedValues[0]?.amountCents).toBe(-3000);
  });

  it('memo includes dollar-formatted delta', async () => {
    const insertedValues: Record<string, unknown>[] = [];
    const insertChain = {
      values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
      }),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createPriceAdjustmentLedgerEntry({
      orderId: 'order-1',
      sellerId: 'seller-1',
      originalPriceCents: 10000,
      adjustedPriceCents: 7000,
    });

    expect(typeof insertedValues[0]?.memo).toBe('string');
    expect((insertedValues[0]?.memo as string)).toContain('$30.00');
  });

  it('reasonCode follows local:{orderId}:price-adjustment pattern', async () => {
    const insertedValues: Record<string, unknown>[] = [];
    const insertChain = {
      values: vi.fn().mockImplementation(async (vals: Record<string, unknown>) => {
        insertedValues.push(vals);
      }),
    };
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createPriceAdjustmentLedgerEntry({
      orderId: 'order-abc',
      sellerId: 'seller-1',
      originalPriceCents: 10000,
      adjustedPriceCents: 8000,
    });

    expect(insertedValues[0]?.reasonCode).toBe('local:order-abc:price-adjustment');
  });
});
