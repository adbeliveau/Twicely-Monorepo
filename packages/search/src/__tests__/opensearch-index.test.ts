import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = vi.hoisted(() => ({
  index: vi.fn().mockResolvedValue({ body: {} }),
  delete: vi.fn().mockResolvedValue({ body: {} }),
  update: vi.fn().mockResolvedValue({ body: {} }),
  bulk: vi.fn().mockResolvedValue({ body: { items: [] } }),
}));

vi.mock('../opensearch-client', () => ({
  getOpenSearchClient: vi.fn(() => mockClient),
}));

vi.mock('../opensearch-mapping', () => ({
  LISTINGS_READ_ALIAS: 'twicely_listings',
}));

import {
  upsertDocument,
  deleteDocument,
  bulkUpsert,
  partialUpdate,
  bulkPartialUpdate,
} from '../opensearch-index';
import type { ListingDocument } from '../typesense-index';

const baseDoc: ListingDocument = {
  id: 'lst-1',
  slug: 'item-1',
  title: 'Nike Air Jordan',
  description: 'Classic sneaker',
  priceCents: 9999,
  originalPriceCents: 12999,
  shippingCents: 599,
  condition: 'VERY_GOOD',
  brand: 'Nike',
  tags: 'sneakers,jordan,retro',
  categoryId: 'cat-1',
  categoryName: 'Sneakers',
  categorySlug: 'sneakers',
  freeShipping: false,
  availableQuantity: 1,
  ownerUserId: 'usr-1',
  sellerName: 'Bob',
  sellerUsername: 'bob',
  sellerAvatarUrl: '',
  sellerScore: 85,
  sellerTotalReviews: 10,
  sellerAverageRating: 4.5,
  sellerShowStars: true,
  sellerPerformanceBand: 'GOLD',
  primaryImageUrl: '',
  primaryImageAlt: '',
  activatedAt: 1700000000000,
  createdAt: 1700000000000,
  boostPercent: 0,
  fulfillmentType: 'SHIP_ONLY',
  authenticationStatus: 'NOT_APPLICABLE',
  dealBadgeType: '',
  storefrontCategoryId: '',
};

describe('upsertDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('indexes a document to the read alias', async () => {
    await upsertDocument(baseDoc);
    expect(mockClient.index).toHaveBeenCalledWith({
      index: 'twicely_listings',
      id: 'lst-1',
      body: baseDoc,
      refresh: false,
    });
  });
});

describe('deleteDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a document by ID', async () => {
    await deleteDocument('lst-1');
    expect(mockClient.delete).toHaveBeenCalledWith({
      index: 'twicely_listings',
      id: 'lst-1',
      refresh: false,
    });
  });

  it('silently ignores 404 errors', async () => {
    mockClient.delete.mockRejectedValueOnce({ statusCode: 404 });
    await expect(deleteDocument('missing-id')).resolves.toBeUndefined();
  });

  it('rethrows non-404 errors', async () => {
    mockClient.delete.mockRejectedValueOnce(new Error('server error'));
    await expect(deleteDocument('lst-1')).rejects.toThrow('server error');
  });
});

describe('bulkUpsert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns early for empty array', async () => {
    const result = await bulkUpsert([]);
    expect(result).toEqual({ success: 0, failed: 0 });
    expect(mockClient.bulk).not.toHaveBeenCalled();
  });

  it('sends bulk request and counts results', async () => {
    mockClient.bulk.mockResolvedValueOnce({
      body: {
        items: [
          { index: { _id: 'lst-1', status: 201 } },
          { index: { _id: 'lst-2', error: { type: 'mapper_parsing_exception' } } },
        ],
      },
    });

    const result = await bulkUpsert([baseDoc, { ...baseDoc, id: 'lst-2' }]);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('partialUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends partial update request', async () => {
    await partialUpdate('lst-1', { sellerScore: 90 });
    expect(mockClient.update).toHaveBeenCalledWith({
      index: 'twicely_listings',
      id: 'lst-1',
      body: { doc: { sellerScore: 90 } },
      refresh: false,
    });
  });

  it('silently ignores 404 on missing document', async () => {
    mockClient.update.mockRejectedValueOnce({ statusCode: 404 });
    await expect(partialUpdate('missing', { sellerScore: 90 })).resolves.toBeUndefined();
  });
});

describe('bulkPartialUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns early for empty array', async () => {
    const result = await bulkPartialUpdate([]);
    expect(result).toEqual({ success: 0, failed: 0 });
    expect(mockClient.bulk).not.toHaveBeenCalled();
  });

  it('sends bulk update and counts results', async () => {
    mockClient.bulk.mockResolvedValueOnce({
      body: {
        items: [
          { update: { _id: 'lst-1', status: 200 } },
          { update: { _id: 'lst-2', status: 200 } },
        ],
      },
    });

    const result = await bulkPartialUpdate([
      { id: 'lst-1', fields: { sellerScore: 90 } },
      { id: 'lst-2', fields: { sellerScore: 85 } },
    ]);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
  });
});
