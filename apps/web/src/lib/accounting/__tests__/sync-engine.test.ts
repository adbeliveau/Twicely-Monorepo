/**
 * Tests for sync-engine.ts — G10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDecrypt = vi.fn();
const mockGetAdapter = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  accountingIntegration: { id: 'id', userId: 'userId', provider: 'provider' },
  accountingSyncLog: { id: 'id', integrationId: 'integrationId' },
  accountingEntityMap: { id: 'id', integrationId: 'integrationId' },
  order: { id: 'id', sellerId: 'sellerId', status: 'status', completedAt: 'completedAt' },
  expense: { id: 'id', userId: 'userId', expenseDate: 'expenseDate' },
  payout: { id: 'id', userId: 'userId', status: 'status', amountCents: 'amountCents', createdAt: 'createdAt' },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/db/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../adapter-factory', () => ({
  getAccountingAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

vi.mock('../entity-mappers', () => ({
  orderToInvoice: vi.fn().mockReturnValue({
    customerName: 'Test Buyer',
    lineItems: [{ description: 'Sale', amountCents: 5000, quantity: 1 }],
    datePaid: new Date('2026-01-01'),
    reference: 'order-001',
  }),
  expenseToExpenseData: vi.fn().mockReturnValue({
    vendor: 'USPS',
    category: 'Shipping',
    amountCents: 1500,
    date: new Date('2026-01-01'),
    description: 'Shipping supplies',
    reference: 'exp-001',
  }),
}));

const INTEGRATION_ID = 'integration-test-001';

const MOCK_INTEGRATION = {
  id: INTEGRATION_ID,
  userId: 'user-001',
  provider: 'QUICKBOOKS',
  accessToken: 'encrypted-access-token',
  refreshToken: 'encrypted-refresh-token',
  externalAccountId: 'realm-001',
  lastSyncAt: null,
  status: 'CONNECTED',
};

const MOCK_ADAPTER = {
  provider: 'QUICKBOOKS',
  createInvoice: vi.fn().mockResolvedValue({ externalId: 'qb-inv-001', externalType: 'INVOICE' }),
  createExpense: vi.fn().mockResolvedValue({ externalId: 'qb-exp-001', externalType: 'BILL' }),
};

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeInsertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returning),
    }),
  };
}

function makeInsertNoReturning() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('syncSales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDecrypt.mockReturnValue('plain-access-token');
    mockGetAdapter.mockReturnValue(MOCK_ADAPTER);
    MOCK_ADAPTER.createInvoice.mockResolvedValue({ externalId: 'qb-inv-001', externalType: 'INVOICE' });
  });

  it('throws when integration is not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { syncSales } = await import('../sync-engine');
    await expect(syncSales(INTEGRATION_ID)).rejects.toThrow('Integration not found');
  });

  it('throws when integration is missing tokens', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ ...MOCK_INTEGRATION, accessToken: null }]),
    );
    const { syncSales } = await import('../sync-engine');
    await expect(syncSales(INTEGRATION_ID)).rejects.toThrow('missing tokens');
  });

  it('queries completed orders since lastSyncAt', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))  // get integration
      .mockReturnValueOnce({                                       // get orders
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'order-001', buyerId: 'buyer-001', totalCents: 5000, shippingCents: 500, completedAt: new Date() }]),
          }),
        }),
      })
      .mockReturnValueOnce(makeSelectChain([]));  // entity map check — not synced yet

    mockDbInsert.mockReturnValue(makeInsertNoReturning());

    const { syncSales } = await import('../sync-engine');
    const result = await syncSales(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(1);
    expect(result.recordsFailed).toBe(0);
  });

  it('skips already-synced orders (idempotent)', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'order-001', buyerId: 'buyer-001', totalCents: 5000, shippingCents: 0, completedAt: new Date() }]),
          }),
        }),
      })
      .mockReturnValueOnce(makeSelectChain([{ id: 'existing-map-entry' }]));  // already synced

    const { syncSales } = await import('../sync-engine');
    const result = await syncSales(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(0);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('tracks partial failures when adapter throws', async () => {
    MOCK_ADAPTER.createInvoice.mockRejectedValue(new Error('QB API down'));

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'order-001', buyerId: 'buyer-001', totalCents: 5000, shippingCents: 0, completedAt: new Date() }]),
          }),
        }),
      })
      .mockReturnValueOnce(makeSelectChain([]));

    const { syncSales } = await import('../sync-engine');
    const result = await syncSales(INTEGRATION_ID);

    expect(result.recordsFailed).toBe(1);
    expect(result.errorMessage).toContain('order-001');
  });

  it('decrypts access token before use', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

    const { syncSales } = await import('../sync-engine');
    await syncSales(INTEGRATION_ID);

    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-access-token');
  });
});

describe('syncExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDecrypt.mockReturnValue('plain-access-token');
    mockGetAdapter.mockReturnValue(MOCK_ADAPTER);
    MOCK_ADAPTER.createExpense.mockResolvedValue({ externalId: 'qb-exp-001', externalType: 'BILL' });
  });

  it('syncs expenses and records in entityMap', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'exp-001', vendor: 'USPS', category: 'Shipping', amountCents: 1500, expenseDate: new Date(), description: null }]),
          }),
        }),
      })
      .mockReturnValueOnce(makeSelectChain([]));  // not yet synced

    mockDbInsert.mockReturnValue(makeInsertNoReturning());

    const { syncExpenses } = await import('../sync-engine');
    const result = await syncExpenses(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(1);
  });
});

describe('runFullSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDecrypt.mockReturnValue('plain-access-token');
    mockGetAdapter.mockReturnValue(MOCK_ADAPTER);
    MOCK_ADAPTER.createInvoice.mockResolvedValue({ externalId: 'qb-inv-001', externalType: 'INVOICE' });
    MOCK_ADAPTER.createExpense.mockResolvedValue({ externalId: 'qb-exp-001', externalType: 'BILL' });
  });

  it('creates sync log entry and updates integration after sync', async () => {
    mockDbInsert.mockReturnValueOnce(makeInsertChain([{ id: 'log-001' }]));  // log entry

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))  // runFullSync: get integration for notification
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))  // refreshIntegrationTokens: get integration
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))  // syncSales: get integration
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) })  // orders
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))  // syncExpenses: get integration
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) })  // expenses
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))  // syncPayouts: get integration
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) });  // payouts

    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { runFullSync } = await import('../sync-engine');
    const result = await runFullSync(INTEGRATION_ID);

    expect(result.logId).toBe('log-001');
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});
