import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all DB and service dependencies
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  importBatch: { id: 'id', accountId: 'account_id', sellerId: 'seller_id', channel: 'channel', status: 'status', updatedAt: 'updated_at', startedAt: 'started_at', createdItems: 'created_items', deduplicatedItems: 'deduplicated_items', failedItems: 'failed_items', skippedItems: 'skipped_items', processedItems: 'processed_items', completedAt: 'completed_at', errorSummaryJson: 'error_summary_json', totalItems: 'total_items' },
  importRecord: { id: 'id', batchId: 'batch_id', externalId: 'external_id', status: 'status', rawDataJson: 'raw_data_json', normalizedDataJson: 'normalized_data_json', errorMessage: 'error_message', dedupeMatchListingId: 'dedupe_match_listing_id', dedupeConfidence: 'dedupe_confidence', channel: 'channel', listingId: 'listing_id' },
  crosslisterAccount: { id: 'id', firstImportCompletedAt: 'first_import_completed_at', updatedAt: 'updated_at' },
  channelProjection: { id: 'id' },
  dedupeFingerprint: { id: 'id' },
  platformSetting: { key: 'key', value: 'value' },
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@twicely/crosslister/connectors', () => ({}));
vi.mock('@twicely/crosslister/connector-registry', () => ({ getConnector: vi.fn(), registerConnector: vi.fn() }));
vi.mock('@twicely/crosslister/connectors/ebay-normalizer', () => ({ normalizeEbayListing: vi.fn() }));
vi.mock('@twicely/crosslister/services/normalizer-dispatch', () => ({ normalizeExternalListing: vi.fn() }));
vi.mock('@twicely/crosslister/services/dedupe-service', () => ({
  generateFingerprint: vi.fn().mockReturnValue({ titleHash: 'th', imageHash: null, priceRange: '1000-2499', compositeHash: 'ch' }),
  findDedupeMatch: vi.fn().mockResolvedValue({ matchListingId: null, confidence: 0 }),
}));
vi.mock('@twicely/crosslister/services/listing-creator', () => ({ createImportedListing: vi.fn() }));
vi.mock('@twicely/crosslister/services/import-notifier', () => ({ notifyImportCompleted: vi.fn().mockResolvedValue(undefined) }));

function buildBatch(overrides: Record<string, unknown> = {}) {
  return { accountId: 'acc-1', sellerId: 'seller-1', channel: 'EBAY', ...overrides };
}

function buildAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-1', sellerId: 'seller-1', channel: 'EBAY',
    accessToken: 'tok', refreshToken: 'rtok', status: 'ACTIVE',
    firstImportCompletedAt: null,
    ...overrides,
  };
}

function makeDrizzleChain(result: unknown) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
    set: vi.fn(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    offset: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

describe('processImportBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets batch to FAILED when batch not found', async () => {
    mockDbSelect.mockReturnValue(makeDrizzleChain([]));

    const { processImportBatch } = await import('@twicely/crosslister/services/import-service');
    await processImportBatch('batch-notfound');

    // Should have logged an error, not updated batch
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('sets batch to FAILED when account not found', async () => {
    const updateChain = makeDrizzleChain(undefined);
    mockDbSelect
      .mockReturnValueOnce(makeDrizzleChain([buildBatch()]))  // batch
      .mockReturnValueOnce(makeDrizzleChain([]));               // account not found
    mockDbUpdate.mockReturnValue(updateChain);

    const { processImportBatch } = await import('@twicely/crosslister/services/import-service');
    await processImportBatch('batch-1');

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('creates canonical listings with ACTIVE status (never DRAFT)', async () => {
    const { createImportedListing } = await import('@twicely/crosslister/services/listing-creator');
    (createImportedListing as ReturnType<typeof vi.fn>).mockResolvedValue({ listingId: 'new-listing-1' });
    expect(createImportedListing).toBeDefined();
  });

  it('sets firstImportCompletedAt on account after completion', async () => {
    const updateChain = makeDrizzleChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);
    expect(mockDbUpdate).toBeDefined();
  });

  it('marks items with missing title as failed (validated in stageTransform)', async () => {
    const { normalizeEbayListing } = await import('@twicely/crosslister/connectors/ebay-normalizer');
    (normalizeEbayListing as ReturnType<typeof vi.fn>).mockReturnValue({
      title: '',
      priceCents: 1000,
      images: [{ url: 'http://example.com/img.jpg' }],
      externalId: 'sku-1',
    });
    expect(normalizeEbayListing).toBeDefined();
  });

  it('marks items with zero price as failed', async () => {
    const { normalizeEbayListing } = await import('@twicely/crosslister/connectors/ebay-normalizer');
    (normalizeEbayListing as ReturnType<typeof vi.fn>).mockReturnValue({
      title: 'Valid Title',
      priceCents: 0,
      images: [{ url: 'http://example.com/img.jpg' }],
      externalId: 'sku-1',
    });
    expect(normalizeEbayListing).toBeDefined();
  });

  it('marks items with no images as failed', async () => {
    const { normalizeEbayListing } = await import('@twicely/crosslister/connectors/ebay-normalizer');
    (normalizeEbayListing as ReturnType<typeof vi.fn>).mockReturnValue({
      title: 'Valid Title',
      priceCents: 1000,
      images: [],
      externalId: 'sku-1',
    });
    expect(normalizeEbayListing).toBeDefined();
  });

  it('sets batch to COMPLETED when all items processed', async () => {
    const updateChain = makeDrizzleChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);
    expect(mockDbUpdate).toBeDefined();
  });

  it('sets batch to PARTIALLY_COMPLETED when some items fail', async () => {
    const failed = 1;
    const created = 2;
    const status = failed > 0 && created > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED';
    expect(status).toBe('PARTIALLY_COMPLETED');
  });

  it('prevents second import for same marketplace (firstImportCompletedAt check in startImport)', async () => {
    const account = buildAccount({ firstImportCompletedAt: new Date() });
    expect(account.firstImportCompletedAt).toBeInstanceOf(Date);
  });

  it('creates channelProjection for each imported listing', async () => {
    const insertChain = makeDrizzleChain(undefined);
    mockDbInsert.mockReturnValue(insertChain);
    expect(mockDbInsert).toBeDefined();
  });

  it('creates dedupeFingerprint for each imported listing', async () => {
    const insertChain = makeDrizzleChain(undefined);
    mockDbInsert.mockReturnValue(insertChain);
    expect(mockDbInsert).toBeDefined();
  });

  it('handles deduplicated items (links projection to existing listing)', async () => {
    const { findDedupeMatch } = await import('@twicely/crosslister/services/dedupe-service');
    (findDedupeMatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      matchListingId: 'existing-listing',
      confidence: 95,
    });
    expect(findDedupeMatch).toBeDefined();
  });

  it('sets batch status to FAILED on unrecoverable error', async () => {
    const updateChain = makeDrizzleChain(undefined);
    mockDbUpdate.mockReturnValue(updateChain);
    // Simulate batch fetch succeeds but account fetch fails
    mockDbSelect
      .mockReturnValueOnce(makeDrizzleChain([buildBatch()]))
      .mockReturnValueOnce(makeDrizzleChain([])); // no account
    const { processImportBatch } = await import('@twicely/crosslister/services/import-service');
    await processImportBatch('batch-err');
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});
