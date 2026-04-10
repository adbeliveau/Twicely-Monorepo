import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetPlatformSetting, mockIsKillSwitchActive, mockIsFeatureEnabled,
  mockOsUpsert, mockOsDelete, mockOsPartialUpdate,
  mockTsUpsert, mockTsDelete,
  mockCalculatePromotedSlots,
} = vi.hoisted(() => ({
  mockGetPlatformSetting: vi.fn(),
  mockIsKillSwitchActive: vi.fn(),
  mockIsFeatureEnabled: vi.fn(),
  mockOsUpsert: vi.fn().mockResolvedValue(undefined),
  mockOsDelete: vi.fn().mockResolvedValue(undefined),
  mockOsPartialUpdate: vi.fn().mockResolvedValue(undefined),
  mockTsUpsert: vi.fn().mockResolvedValue(undefined),
  mockTsDelete: vi.fn().mockResolvedValue(undefined),
  mockCalculatePromotedSlots: vi.fn().mockResolvedValue(0),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('@twicely/config/feature-flags', () => ({
  isKillSwitchActive: mockIsKillSwitchActive,
  isFeatureEnabled: mockIsFeatureEnabled,
}));
vi.mock('@twicely/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@twicely/commerce/boosting', () => ({
  calculatePromotedSlots: mockCalculatePromotedSlots,
}));
vi.mock('../shared', () => ({
  mapToListingCard: vi.fn((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''), slug: String(row.slug ?? row.id ?? ''),
    title: String(row.title ?? ''), priceCents: Number(row.priceCents ?? 0),
    originalPriceCents: null, condition: 'GOOD',
    brand: null, freeShipping: false, shippingCents: 0,
    primaryImageUrl: null, primaryImageAlt: null,
    sellerName: '', sellerUsername: '', sellerAvatarUrl: null,
    sellerAverageRating: null, sellerTotalReviews: 0, sellerShowStars: false,
  })),
}));
vi.mock('../opensearch-index', () => ({
  upsertDocument: mockOsUpsert,
  deleteDocument: mockOsDelete,
  partialUpdate: mockOsPartialUpdate,
}));
vi.mock('../typesense-index', () => ({
  upsertListingDocument: mockTsUpsert,
  deleteListingDocument: mockTsDelete,
}));

import {
  getActiveSearchEngine,
  indexDocument,
  deleteDocumentFromIndex,
  partialUpdateDocument,
} from '../search-engine';
import type { ListingDocument } from '../typesense-index';

const baseDoc: ListingDocument = {
  id: 'lst-1', title: 'Nike Shoes', priceCents: 9999, freeShipping: false,
  ownerUserId: 'usr-1', sellerScore: 85, sellerTotalReviews: 10,
  activatedAt: 1700000000, createdAt: 1700000000,
};

describe('getActiveSearchEngine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns postgres when kill.search is OFF', async () => {
    mockIsKillSwitchActive.mockResolvedValue(false);
    const engine = await getActiveSearchEngine();
    expect(engine).toBe('postgres');
  });

  it('returns opensearch when search.engine is opensearch', async () => {
    mockIsKillSwitchActive.mockResolvedValue(true);
    mockGetPlatformSetting.mockResolvedValue('opensearch');
    const engine = await getActiveSearchEngine();
    expect(engine).toBe('opensearch');
  });

  it('returns opensearch when gate.opensearch is enabled', async () => {
    mockIsKillSwitchActive.mockResolvedValue(true);
    mockGetPlatformSetting.mockResolvedValue('typesense');
    mockIsFeatureEnabled.mockResolvedValue(true);
    const engine = await getActiveSearchEngine({ userId: 'usr-1' });
    expect(engine).toBe('opensearch');
  });

  it('returns typesense by default', async () => {
    mockIsKillSwitchActive.mockResolvedValue(true);
    mockGetPlatformSetting.mockResolvedValue('typesense');
    mockIsFeatureEnabled.mockResolvedValue(false);
    const engine = await getActiveSearchEngine();
    expect(engine).toBe('typesense');
  });

  it('returns postgres when search.engine is postgres', async () => {
    mockIsKillSwitchActive.mockResolvedValue(true);
    mockGetPlatformSetting.mockResolvedValue('postgres');
    const engine = await getActiveSearchEngine();
    expect(engine).toBe('postgres');
  });
});

describe('indexDocument — dual write', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes to opensearch only when engine=opensearch, dualWrite=false', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('opensearch') // search.engine
      .mockResolvedValueOnce(false);       // dualWrite

    await indexDocument(baseDoc);
    expect(mockOsUpsert).toHaveBeenCalledWith(baseDoc);
    expect(mockTsUpsert).not.toHaveBeenCalled();
  });

  it('writes to both when dualWrite=true', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('typesense') // search.engine
      .mockResolvedValueOnce(true);       // dualWrite

    await indexDocument(baseDoc);
    expect(mockTsUpsert).toHaveBeenCalledWith(baseDoc);
    expect(mockOsUpsert).toHaveBeenCalledWith(baseDoc);
  });

  it('writes to typesense only when engine=typesense, dualWrite=false', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('typesense')
      .mockResolvedValueOnce(false);

    await indexDocument(baseDoc);
    expect(mockTsUpsert).toHaveBeenCalledWith(baseDoc);
    expect(mockOsUpsert).not.toHaveBeenCalled();
  });
});

describe('deleteDocumentFromIndex — dual write', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes from both when dualWrite=true', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('opensearch')
      .mockResolvedValueOnce(true);

    await deleteDocumentFromIndex('lst-1');
    expect(mockOsDelete).toHaveBeenCalledWith('lst-1');
    expect(mockTsDelete).toHaveBeenCalledWith('lst-1');
  });

  it('deletes from opensearch only when engine=opensearch, no dual write', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('opensearch')
      .mockResolvedValueOnce(false);

    await deleteDocumentFromIndex('lst-1');
    expect(mockOsDelete).toHaveBeenCalledWith('lst-1');
    expect(mockTsDelete).not.toHaveBeenCalled();
  });
});

describe('partialUpdateDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates opensearch when engine=opensearch', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('opensearch')
      .mockResolvedValueOnce(false);

    await partialUpdateDocument('lst-1', { sellerScore: 90 });
    expect(mockOsPartialUpdate).toHaveBeenCalledWith('lst-1', { sellerScore: 90 });
  });

  it('gracefully handles opensearch failure', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce('opensearch')
      .mockResolvedValueOnce(false);
    mockOsPartialUpdate.mockRejectedValueOnce(new Error('conn refused'));

    await expect(partialUpdateDocument('lst-1', { sellerScore: 90 })).resolves.toBeUndefined();
  });
});
