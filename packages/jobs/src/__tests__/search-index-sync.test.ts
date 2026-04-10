/**
 * Search Index Sync Worker Tests — Phase 4 (Decision #143)
 * Validates job processing for upsert, delete, partial-update, and bulk-upsert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockIndexDocument = vi.fn().mockResolvedValue(undefined);
const mockDeleteDocumentFromIndex = vi.fn().mockResolvedValue(undefined);
const mockPartialUpdateDocument = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/search/search-engine', () => ({
  indexDocument: (...args: unknown[]) => mockIndexDocument(...args),
  deleteDocumentFromIndex: (...args: unknown[]) => mockDeleteDocumentFromIndex(...args),
  partialUpdateDocument: (...args: unknown[]) => mockPartialUpdateDocument(...args),
}));

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

vi.mock('@twicely/jobs/queue', () => ({
  createQueue: vi.fn().mockImplementation(() => ({ add: mockQueueAdd })),
  createWorker: vi.fn().mockReturnValue({ on: vi.fn(), close: vi.fn() }),
  connection: {},
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processSearchIndexJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upsert: calls indexDocument with the provided document', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');
    const doc = { id: 'listing-1', title: 'Nike Shoes', priceCents: 5000 };

    await processSearchIndexJob({ type: 'upsert', document: doc });

    expect(mockIndexDocument).toHaveBeenCalledTimes(1);
    expect(mockIndexDocument).toHaveBeenCalledWith(doc);
  });

  it('upsert: skips when document is missing', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');

    await processSearchIndexJob({ type: 'upsert' });

    expect(mockIndexDocument).not.toHaveBeenCalled();
  });

  it('delete: calls deleteDocumentFromIndex with listingId', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');

    await processSearchIndexJob({ type: 'delete', listingId: 'listing-42' });

    expect(mockDeleteDocumentFromIndex).toHaveBeenCalledTimes(1);
    expect(mockDeleteDocumentFromIndex).toHaveBeenCalledWith('listing-42');
  });

  it('delete: skips when listingId is missing', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');

    await processSearchIndexJob({ type: 'delete' });

    expect(mockDeleteDocumentFromIndex).not.toHaveBeenCalled();
  });

  it('partial-update: calls partialUpdateDocument with listingId and fields', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');
    const fields = { sellerScore: 85 };

    await processSearchIndexJob({ type: 'partial-update', listingId: 'listing-7', fields });

    expect(mockPartialUpdateDocument).toHaveBeenCalledTimes(1);
    expect(mockPartialUpdateDocument).toHaveBeenCalledWith('listing-7', fields);
  });

  it('partial-update: skips when listingId or fields missing', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');

    await processSearchIndexJob({ type: 'partial-update', listingId: 'listing-7' });
    await processSearchIndexJob({ type: 'partial-update', fields: { sellerScore: 85 } });

    expect(mockPartialUpdateDocument).not.toHaveBeenCalled();
  });

  it('bulk-upsert: calls indexDocument for each document', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');
    const docs = [
      { id: 'listing-1', title: 'Item A' },
      { id: 'listing-2', title: 'Item B' },
      { id: 'listing-3', title: 'Item C' },
    ];

    await processSearchIndexJob({ type: 'bulk-upsert', documents: docs });

    expect(mockIndexDocument).toHaveBeenCalledTimes(3);
    expect(mockIndexDocument).toHaveBeenCalledWith(docs[0]);
    expect(mockIndexDocument).toHaveBeenCalledWith(docs[1]);
    expect(mockIndexDocument).toHaveBeenCalledWith(docs[2]);
  });

  it('bulk-upsert: skips when documents array is empty', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');

    await processSearchIndexJob({ type: 'bulk-upsert', documents: [] });

    expect(mockIndexDocument).not.toHaveBeenCalled();
  });

  it('unknown type: does not throw', async () => {
    const { processSearchIndexJob } = await import('../search-index-sync');

    await expect(
      processSearchIndexJob({ type: 'unknown' as never }),
    ).resolves.toBeUndefined();
  });
});

describe('enqueue functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueueSearchIndexUpsert adds a job to the queue', async () => {
    const { enqueueSearchIndexUpsert } = await import('../search-index-sync');
    const doc = { id: 'listing-1', title: 'Test' };

    await enqueueSearchIndexUpsert(doc);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'upsert:listing-1',
      { type: 'upsert', document: doc },
    );
  });

  it('enqueueSearchIndexDelete adds a delete job', async () => {
    const { enqueueSearchIndexDelete } = await import('../search-index-sync');

    await enqueueSearchIndexDelete('listing-99');

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'delete:listing-99',
      { type: 'delete', listingId: 'listing-99' },
    );
  });

  it('enqueueSearchIndexPartialUpdate adds a partial-update job', async () => {
    const { enqueueSearchIndexPartialUpdate } = await import('../search-index-sync');

    await enqueueSearchIndexPartialUpdate('listing-5', { sellerScore: 90 });

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'partial-update:listing-5',
      { type: 'partial-update', listingId: 'listing-5', fields: { sellerScore: 90 } },
    );
  });

  it('enqueueSearchIndexBulkUpsert adds a bulk-upsert job', async () => {
    const { enqueueSearchIndexBulkUpsert } = await import('../search-index-sync');
    const docs = [{ id: '1' }, { id: '2' }];

    await enqueueSearchIndexBulkUpsert(docs);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'bulk-upsert:2-docs',
      { type: 'bulk-upsert', documents: docs },
    );
  });
});
