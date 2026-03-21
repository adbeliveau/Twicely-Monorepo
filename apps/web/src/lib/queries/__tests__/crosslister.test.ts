import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: { id: 'id', sellerId: 'seller_id', channel: 'channel', status: 'status', accountId: 'account_id' },
  importBatch: { id: 'id', sellerId: 'seller_id', createdAt: 'created_at', accountId: 'account_id' },
  importRecord: { id: 'id', batchId: 'batch_id', status: 'status' },
  channelProjection: { id: 'id', sellerId: 'seller_id', channel: 'channel', status: 'status' },
}));

function makeChain(result: unknown) {
  const chain = {
    from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn(), offset: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  // Make the chain itself thenable so await works
  Object.assign(chain, {
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject),
  });
  return chain;
}

describe('getConnectedAccounts', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns accounts for seller only', async () => {
    const fakeAccounts = [
      { id: 'acc-1', sellerId: 'seller-1', channel: 'EBAY', status: 'ACTIVE' },
    ];
    mockDbSelect.mockReturnValue(makeChain(fakeAccounts));

    const { getConnectedAccounts } = await import('../crosslister');
    const result = await getConnectedAccounts('seller-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.channel).toBe('EBAY');
  });

  it('returns empty array when no accounts', async () => {
    mockDbSelect.mockReturnValue(makeChain([]));

    const { getConnectedAccounts } = await import('../crosslister');
    const result = await getConnectedAccounts('seller-1');

    expect(result).toHaveLength(0);
  });
});

describe('getImportBatches', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns batches ordered by createdAt DESC', async () => {
    const batches = [
      { id: 'batch-2', sellerId: 'seller-1', createdAt: new Date('2026-01-02') },
      { id: 'batch-1', sellerId: 'seller-1', createdAt: new Date('2026-01-01') },
    ];
    mockDbSelect.mockReturnValue(makeChain(batches));

    const { getImportBatches } = await import('../crosslister');
    const result = await getImportBatches('seller-1');

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('batch-2');
  });
});

describe('getCrosslisterDashboardData', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('aggregates accounts + counts', async () => {
    const accounts = [{ id: 'acc-1', sellerId: 'seller-1', channel: 'EBAY', status: 'ACTIVE' }];
    const batches: unknown[] = [];

    mockDbSelect
      .mockReturnValueOnce(makeChain(accounts))   // getConnectedAccounts
      .mockReturnValueOnce(makeChain(batches))    // getImportBatches
      .mockReturnValueOnce(makeChain([{ total: 5 }])); // getChannelProjectionCount

    const { getCrosslisterDashboardData } = await import('../crosslister');
    const result = await getCrosslisterDashboardData('seller-1');

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]?.channel).toBe('EBAY');
  });
});
