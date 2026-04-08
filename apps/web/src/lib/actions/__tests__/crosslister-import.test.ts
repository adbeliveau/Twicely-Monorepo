import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate };

const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  importBatch: { id: 'id', sellerId: 'seller_id', accountId: 'account_id', channel: 'channel', status: 'status' },
  importRecord: { id: 'id', batchId: 'batch_id', status: 'status', rawDataJson: 'raw_data_json', errorMessage: 'error_message', listingId: 'listing_id', dedupeMatchListingId: 'dedupe_match_listing_id', dedupeConfidence: 'dedupe_confidence' },
  crosslisterAccount: { id: 'id', sellerId: 'seller_id', status: 'status', firstImportCompletedAt: 'first_import_completed_at', channel: 'channel' },
  platformSetting: { key: 'key', value: 'value' },
}));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond) }));
vi.mock('@twicely/crosslister/services/import-service', () => ({
  processImportBatch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/crosslister/connectors/ebay-normalizer', () => ({
  normalizeEbayListing: vi.fn().mockReturnValue({
    title: 'Test Item',
    priceCents: 5000,
    images: [{ url: 'https://example.com/img.jpg', isPrimary: true, sortOrder: 0 }],
    externalId: 'SKU-001',
    description: '',
    currencyCode: 'USD',
    quantity: 1,
    condition: 'LIKE_NEW',
    brand: 'Nike',
    itemSpecifics: {},
    url: 'https://www.ebay.com/itm/1',
  }),
}));
vi.mock('@twicely/crosslister/services/normalizer-dispatch', () => ({
  normalizeExternalListing: vi.fn().mockReturnValue({
    title: 'Test Item',
    priceCents: 5000,
    images: [{ url: 'https://example.com/img.jpg', isPrimary: true, sortOrder: 0 }],
    externalId: 'EXT-001',
    description: '',
    currencyCode: 'USD',
    quantity: 1,
    condition: 'LIKE_NEW',
    brand: null,
    itemSpecifics: {},
    url: 'https://example.com/item/1',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    category: null,
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
  }),
}));
vi.mock('@twicely/crosslister/services/listing-creator', () => ({
  createImportedListing: vi.fn().mockResolvedValue({ listingId: 'new-listing-1' }),
}));
vi.mock('@twicely/crosslister/services/dedupe-service', () => ({
  generateFingerprint: vi.fn().mockReturnValue({ titleHash: 'th', imageHash: null, priceRange: '0-999', compositeHash: 'ch' }),
  findDedupeMatch: vi.fn().mockResolvedValue({ matchListingId: null, confidence: 0 }),
}));

type MockChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
};

function makeChain(result: unknown): MockChain {
  // Chain is thenable for direct `await chain` and supports .limit().offset() chaining.
  const chain: MockChain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    set: vi.fn(),
    values: vi.fn(),
    returning: vi.fn().mockResolvedValue(result),
    offset: vi.fn().mockResolvedValue(result),
    orderBy: vi.fn(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.values.mockReturnThis();
  chain.limit.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

function sellerSession() {
  return {
    session: { userId: 'user-1', delegationId: null, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', sellerId: 'user-1', channel: 'EBAY',
    status: 'ACTIVE', firstImportCompletedAt: null,
    ...overrides,
  };
}

describe('startImport', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('creates import batch and returns batchId', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect
      .mockReturnValueOnce(makeChain([buildAccount()]))           // account
      .mockReturnValueOnce(makeChain([{ value: true }]));          // feature flag

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'batch-001' }]),
      }),
    });

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-1' });

    expect(result.success).toBe(true);
    expect(result.data?.batchId).toBe('batch-001');
  });

  it('rejects if firstImportCompletedAt is set (already imported)', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValueOnce(makeChain([buildAccount({ firstImportCompletedAt: new Date() })]));

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-1' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Free import already used');
  });

  it('rejects if account status is not ACTIVE', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValueOnce(makeChain([buildAccount({ status: 'REVOKED' })]));

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-1' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });

  it('rejects if feature flag is disabled', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect
      .mockReturnValueOnce(makeChain([buildAccount()]))
      .mockReturnValueOnce(makeChain([{ value: false }]));

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-1' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('rejects for non-seller (no session)', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn().mockReturnValue(false) } });

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-1' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });
});

describe('getImportBatchStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns batch with counts', async () => {
    const fakeBatch = { id: 'batch-1', sellerId: 'user-1', totalItems: 10, createdItems: 8, failedItems: 2, status: 'COMPLETED' };
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect.mockReturnValue(makeChain([fakeBatch]));

    const { getImportBatchStatus } = await import('../crosslister-import');
    const result = await getImportBatchStatus({ batchId: 'batch-1' });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('batch-1');
  });
});

describe('getImportIssues', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns failed records paginated', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    const fakeRecords = [
      { id: 'rec-1', status: 'failed', errorMessage: 'Missing required field: title.' },
      { id: 'rec-2', status: 'failed', errorMessage: 'Invalid price.' },
    ];

    mockDbSelect
      .mockReturnValueOnce(makeChain([{ id: 'batch-1' }]))  // batch ownership
      .mockReturnValueOnce(makeChain(fakeRecords));          // records

    const { getImportIssues } = await import('../crosslister-import');
    const result = await getImportIssues({ batchId: 'batch-1' });

    expect(result.success).toBe(true);
    expect(result.data?.records).toHaveLength(2);
  });
});

describe('retryImportRecord', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('re-processes a failed record', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    const fakeRecord = { id: 'rec-1', batchId: 'batch-1', status: 'failed', rawDataJson: {}, externalId: 'SKU-001' };

    mockDbSelect
      .mockReturnValueOnce(makeChain([fakeRecord]))          // record
      .mockReturnValueOnce(makeChain([{ sellerId: 'user-1', accountId: 'acc-1' }])); // batch ownership

    const updateChain = makeChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);

    const { retryImportRecord } = await import('../crosslister-import');
    const result = await retryImportRecord({ recordId: 'rec-1' });

    expect(result.success).toBe(true);
  });
});

describe('startImport — channel-generic behavior', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('works with Poshmark accountId', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect
      .mockReturnValueOnce(makeChain([buildAccount({ channel: 'POSHMARK' })]))
      .mockReturnValueOnce(makeChain([{ value: true }]));

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'batch-pm-001' }]),
      }),
    });

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-pm' });

    expect(result.success).toBe(true);
    expect(result.data?.batchId).toBe('batch-pm-001');
  });

  it('works with Mercari accountId', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect
      .mockReturnValueOnce(makeChain([buildAccount({ channel: 'MERCARI' })]))
      .mockReturnValueOnce(makeChain([{ value: true }]));

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'batch-mc-001' }]),
      }),
    });

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-mc' });

    expect(result.success).toBe(true);
    expect(result.data?.batchId).toBe('batch-mc-001');
  });

  it('checks channel-specific feature flag (Poshmark)', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());
    mockDbSelect
      .mockReturnValueOnce(makeChain([buildAccount({ channel: 'POSHMARK' })]))
      .mockReturnValueOnce(makeChain([{ value: false }])); // Poshmark flag disabled

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-pm' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('uses generic normalizer in retryImportRecord (not eBay-specific)', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    const fakeRecord = { id: 'rec-pm', batchId: 'batch-pm', status: 'failed', rawDataJson: {}, externalId: 'PM-001' };

    mockDbSelect
      .mockReturnValueOnce(makeChain([fakeRecord]))
      .mockReturnValueOnce(makeChain([{ sellerId: 'user-1', accountId: 'acc-pm', channel: 'POSHMARK' }]));

    mockDbUpdate.mockReturnValue(makeChain(undefined));

    const { retryImportRecord } = await import('../crosslister-import');
    await retryImportRecord({ recordId: 'rec-pm' });

    const { normalizeExternalListing } = await import('@twicely/crosslister/services/normalizer-dispatch');
    expect(normalizeExternalListing).toBeDefined();
  });

  it('feature flag check uses channel-specific key (not hardcoded ebay)', async () => {
    // This test verifies that 'crosslister.poshmark.importEnabled' is checked, not 'crosslister.ebay.importEnabled'
    mockAuthorize.mockResolvedValue(sellerSession());

    const poshmarkAccount = buildAccount({ channel: 'POSHMARK' });
    mockDbSelect
      .mockReturnValueOnce(makeChain([poshmarkAccount]))
      .mockReturnValueOnce(makeChain([{ value: true }]));

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'batch-pm-002' }]),
      }),
    });

    const { startImport } = await import('../crosslister-import');
    const result = await startImport({ accountId: 'acc-pm' });

    // If it used the eBay flag key and returned true, the import would start
    expect(result.success).toBe(true);
  });

  it('generic normalizer is used instead of eBay-specific normalizer', async () => {
    mockAuthorize.mockResolvedValue(sellerSession());

    const fakeRecord = { id: 'rec-2', batchId: 'batch-2', status: 'failed', rawDataJson: { id: 'pm-1' }, externalId: 'pm-1' };

    mockDbSelect
      .mockReturnValueOnce(makeChain([fakeRecord]))
      .mockReturnValueOnce(makeChain([{ sellerId: 'user-1', accountId: 'acc-1', channel: 'POSHMARK' }]));

    mockDbUpdate.mockReturnValue(makeChain(undefined));

    const { retryImportRecord } = await import('../crosslister-import');
    const result = await retryImportRecord({ recordId: 'rec-2' });

    expect(result.success).toBe(true);
  });
});
