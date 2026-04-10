/**
 * Tests for sync-engine.ts — refreshIntegrationTokens + syncPayouts — G10.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDecrypt = vi.fn();
const mockEncrypt = vi.fn();
const mockGetAdapter = vi.fn();
const mockPayoutToJournalEntry = vi.fn();
const mockNotifyAccountingSync = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  accountingIntegration: { id: 'id', userId: 'userId', provider: 'provider', refreshToken: 'refreshToken', accessToken: 'accessToken' },
  accountingSyncLog: { id: 'id', integrationId: 'integrationId' },
  accountingEntityMap: { id: 'id', integrationId: 'integrationId', twicelyEntityType: 'twicelyEntityType', twicelyEntityId: 'twicelyEntityId' },
  order: { id: 'id', sellerId: 'sellerId', status: 'status', completedAt: 'completedAt' },
  expense: { id: 'id', userId: 'userId', expenseDate: 'expenseDate' },
  payout: { id: 'id', userId: 'userId', status: 'status', amountCents: 'amountCents', createdAt: 'createdAt' },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback?: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/db/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../adapter-factory', () => ({
  getAccountingAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

vi.mock('../entity-mappers', () => ({
  orderToInvoice: vi.fn(),
  expenseToExpenseData: vi.fn(),
  payoutToJournalEntry: (...args: unknown[]) => mockPayoutToJournalEntry(...args),
}));

vi.mock('../accounting-notifier', () => ({
  notifyAccountingSync: (...args: unknown[]) => mockNotifyAccountingSync(...args),
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
  refreshTokens: vi.fn(),
  createJournalEntry: vi.fn(),
  createInvoice: vi.fn(),
  createExpense: vi.fn(),
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

function makeSelectChainNoLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeInsertNoReturning() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

// ─── refreshIntegrationTokens ────────────────────────────────────────────────

describe('refreshIntegrationTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDecrypt.mockReturnValue('plain-refresh-token');
    mockEncrypt.mockImplementation((s: string) => `encrypted-${s}`);
    mockGetAdapter.mockReturnValue(MOCK_ADAPTER);
    MOCK_ADAPTER.refreshTokens.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('throws when integration is not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { refreshIntegrationTokens } = await import('../sync-engine');
    await expect(refreshIntegrationTokens('nonexistent-id')).rejects.toThrow(
      'Integration not found: nonexistent-id',
    );
  });

  it('throws when integration has no refresh token', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ ...MOCK_INTEGRATION, refreshToken: null }]),
    );
    const { refreshIntegrationTokens } = await import('../sync-engine');
    await expect(refreshIntegrationTokens(INTEGRATION_ID)).rejects.toThrow(
      'Integration missing refresh token',
    );
  });

  it('decrypts stored refresh token before passing to adapter', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { refreshIntegrationTokens } = await import('../sync-engine');
    await refreshIntegrationTokens(INTEGRATION_ID);

    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-refresh-token');
    expect(MOCK_ADAPTER.refreshTokens).toHaveBeenCalledWith('plain-refresh-token');
  });

  it('encrypts new tokens before saving to DB', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { refreshIntegrationTokens } = await import('../sync-engine');
    await refreshIntegrationTokens(INTEGRATION_ID);

    expect(mockEncrypt).toHaveBeenCalledWith('new-access-token');
    expect(mockEncrypt).toHaveBeenCalledWith('new-refresh-token');

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'encrypted-new-access-token',
        refreshToken: 'encrypted-new-refresh-token',
      }),
    );
  });

  it('calls update where integration id matches', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { refreshIntegrationTokens } = await import('../sync-engine');
    await refreshIntegrationTokens(INTEGRATION_ID);

    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(updateChain.set).toHaveBeenCalled();
  });

  it('resolves without error for valid integration', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([MOCK_INTEGRATION]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { refreshIntegrationTokens } = await import('../sync-engine');
    await expect(refreshIntegrationTokens(INTEGRATION_ID)).resolves.toBeUndefined();
  });
});

// ─── syncPayouts ─────────────────────────────────────────────────────────────

describe('syncPayouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDecrypt.mockReturnValue('plain-access-token');
    mockGetAdapter.mockReturnValue(MOCK_ADAPTER);
    mockPayoutToJournalEntry.mockReturnValue({
      memo: 'Twicely payout payout-001',
      lines: [
        { accountName: 'Accounts Receivable', debitCents: 0, creditCents: 5000 },
        { accountName: 'Bank', debitCents: 5000, creditCents: 0 },
      ],
      date: new Date('2026-01-15'),
      reference: 'payout-001',
    });
    MOCK_ADAPTER.createJournalEntry.mockResolvedValue({
      externalId: 'qb-je-001',
      externalType: 'JOURNAL_ENTRY',
    });
  });

  it('throws when integration is not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const { syncPayouts } = await import('../sync-engine');
    await expect(syncPayouts(INTEGRATION_ID)).rejects.toThrow(
      'Integration not found',
    );
  });

  it('throws when integration is missing access token', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ ...MOCK_INTEGRATION, accessToken: null }]),
    );
    const { syncPayouts } = await import('../sync-engine');
    await expect(syncPayouts(INTEGRATION_ID)).rejects.toThrow(
      'missing tokens or account ID',
    );
  });

  it('throws when integration is missing externalAccountId', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ ...MOCK_INTEGRATION, externalAccountId: null }]),
    );
    const { syncPayouts } = await import('../sync-engine');
    await expect(syncPayouts(INTEGRATION_ID)).rejects.toThrow(
      'missing tokens or account ID',
    );
  });

  it('returns zero records when no completed payouts exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce(makeSelectChainNoLimit([]));

    const { syncPayouts } = await import('../sync-engine');
    const result = await syncPayouts(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(0);
    expect(result.recordsFailed).toBe(0);
    expect(result.errorMessage).toBeNull();
  });

  it('syncs a payout and inserts entityMap entry', async () => {
    const payoutRow = {
      id: 'payout-001',
      amountCents: 5000,
      createdAt: new Date('2026-01-15'),
    };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce(makeSelectChainNoLimit([payoutRow]))
      .mockReturnValueOnce(makeSelectChain([]));  // entityMap — not yet synced

    mockDbInsert.mockReturnValue(makeInsertNoReturning());

    const { syncPayouts } = await import('../sync-engine');
    const result = await syncPayouts(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(1);
    expect(result.recordsFailed).toBe(0);
    expect(result.errorMessage).toBeNull();
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });

  it('skips already-synced payouts (idempotent)', async () => {
    const payoutRow = { id: 'payout-001', amountCents: 5000, createdAt: new Date() };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce(makeSelectChainNoLimit([payoutRow]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'existing-map-entry' }]));  // already synced

    const { syncPayouts } = await import('../sync-engine');
    const result = await syncPayouts(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(0);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('tracks failure when adapter.createJournalEntry throws', async () => {
    MOCK_ADAPTER.createJournalEntry.mockRejectedValue(new Error('QB API error'));

    const payoutRow = { id: 'payout-002', amountCents: 3000, createdAt: new Date() };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce(makeSelectChainNoLimit([payoutRow]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { syncPayouts } = await import('../sync-engine');
    const result = await syncPayouts(INTEGRATION_ID);

    expect(result.recordsSynced).toBe(0);
    expect(result.recordsFailed).toBe(1);
    expect(result.errorMessage).toContain('payout-002');
  });

  it('decrypts access token before calling adapter', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce(makeSelectChainNoLimit([]));

    const { syncPayouts } = await import('../sync-engine');
    await syncPayouts(INTEGRATION_ID);

    expect(mockDecrypt).toHaveBeenCalledWith('encrypted-access-token');
  });

  it('caps errorMessage at 3 errors joined by semicolons', async () => {
    MOCK_ADAPTER.createJournalEntry.mockRejectedValue(new Error('Boom'));

    const manyPayouts = [
      { id: 'p-1', amountCents: 100, createdAt: new Date() },
      { id: 'p-2', amountCents: 200, createdAt: new Date() },
      { id: 'p-3', amountCents: 300, createdAt: new Date() },
      { id: 'p-4', amountCents: 400, createdAt: new Date() },
    ];

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([MOCK_INTEGRATION]))
      .mockReturnValueOnce(makeSelectChainNoLimit(manyPayouts))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { syncPayouts } = await import('../sync-engine');
    const result = await syncPayouts(INTEGRATION_ID);

    expect(result.recordsFailed).toBe(4);
    // errorMessage is capped to first 3 joined by '; '
    const parts = result.errorMessage?.split('; ') ?? [];
    expect(parts.length).toBe(3);
  });
});
