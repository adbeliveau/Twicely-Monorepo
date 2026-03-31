/** Tests for postOffPlatformSale — informational ledger entries for off-platform sales. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const mockTx = { insert: vi.fn() };

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: { id: 'id', userId: 'user_id', reasonCode: 'reason_code', type: 'type' },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// --- Helpers ---

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

const BASE_PARAMS = {
  userId: 'seller-1',
  listingId: 'lst-abc',
  channel: 'EBAY' as const,
  externalOrderId: 'order-ebay-999',
  salePriceCents: 5000,
  platformFeeCents: 645,
  soldAt: new Date('2026-02-01T12:00:00Z'),
};

describe('postOffPlatformSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('creates two ledger entries for an eBay sale', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([])); // no existing entry

    const inserts: unknown[] = [];
    mockTx.insert.mockImplementation(() => {
      const chain = { values: vi.fn().mockImplementation((v: unknown) => { inserts.push(v); return Promise.resolve(); }) };
      return chain;
    });
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    expect(inserts.length).toBe(2);
  });

  it('revenue entry has positive salePriceCents', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    const revenue = insertValues.find((v) => v['type'] === 'CROSSLISTER_SALE_REVENUE');
    expect(revenue).toBeDefined();
    expect(revenue?.['amountCents']).toBe(5000);
    expect(revenue?.['amountCents']).toBeGreaterThan(0);
  });

  it('fee entry has negative platformFeeCents', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    const fee = insertValues.find((v) => v['type'] === 'CROSSLISTER_PLATFORM_FEE');
    expect(fee).toBeDefined();
    expect(fee?.['amountCents']).toBe(-645);
    expect(fee?.['amountCents']).toBeLessThan(0);
  });

  it('is idempotent — duplicate externalOrderId skips insert', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    // Simulate existing entry found
    dbMock.select.mockReturnValue(makeSelectChain([{ id: 'existing-entry' }]));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    // transaction should NOT be called when entry already exists
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('revenue entry metadata includes channel and externalOrderId in memo/reasonCode', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    const revenue = insertValues.find((v) => v['type'] === 'CROSSLISTER_SALE_REVENUE');
    expect(String(revenue?.['reasonCode'])).toContain('order-ebay-999');
    expect(String(revenue?.['memo'])).toContain('EBAY');
    expect(String(revenue?.['memo'])).toContain('order-ebay-999');
  });

  it('sellerBalance is NOT updated by off-platform sale', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock; update?: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const updateSpy = vi.fn();
    (dbMock as Record<string, unknown>)['update'] = updateSpy;

    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    // No update call means sellerBalance was not modified
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('Poshmark sale with 20% fee stores correct fee amount', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale({
      ...BASE_PARAMS,
      channel: 'POSHMARK',
      externalOrderId: 'posh-order-111',
      salePriceCents: 10000,
      platformFeeCents: 2000, // 20% of $100
    });

    const fee = insertValues.find((v) => v['type'] === 'CROSSLISTER_PLATFORM_FEE');
    expect(fee?.['amountCents']).toBe(-2000);
    expect(fee?.['channel']).toBe('POSHMARK');
  });

  it('both entries are posted inside a single transaction (atomic)', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    let txCallCount = 0;
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
      txCallCount++;
      mockTx.insert.mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      }));
      return fn(mockTx);
    });

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    // Exactly one transaction wraps both inserts
    expect(txCallCount).toBe(1);
    expect(mockTx.insert).toHaveBeenCalledTimes(2);
  });

  it('channel field is set on both entries', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    expect(insertValues[0]?.['channel']).toBe('EBAY');
    expect(insertValues[1]?.['channel']).toBe('EBAY');
  });

  it('revenue entry reasonCode uses xsale:{orderId}:revenue format', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    const revenue = insertValues.find((v) => v['type'] === 'CROSSLISTER_SALE_REVENUE');
    expect(revenue?.['reasonCode']).toBe('xsale:order-ebay-999:revenue');
  });

  it('fee entry reasonCode uses xsale:{orderId}:fee format', async () => {
    const { db } = await import('@twicely/db');
    const dbMock = db as unknown as { select: Mock; transaction: Mock };

    dbMock.select.mockReturnValue(makeSelectChain([]));

    const insertValues: Record<string, unknown>[] = [];
    mockTx.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve();
      }),
    }));
    dbMock.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx));

    const { postOffPlatformSale } = await import('../post-off-platform-sale');
    await postOffPlatformSale(BASE_PARAMS);

    const fee = insertValues.find((v) => v['type'] === 'CROSSLISTER_PLATFORM_FEE');
    expect(fee?.['reasonCode']).toBe('xsale:order-ebay-999:fee');
  });
});
