import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id',
    ownerUserId: 'owner_user_id',
    status: 'status',
    priceCents: 'price_cents',
    slug: 'slug',
  },
  listingImage: { listingId: 'listing_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@/lib/listings/slug', () => ({
  generateListingSlug: vi.fn().mockResolvedValue('test-item-abc123'),
}));

vi.mock('@/lib/listings/seller-activate', () => ({
  ensureSellerProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/notifications/category-alert-notifier', () => ({
  notifyCategoryAlertMatches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/price-history-service', () => ({
  recordPriceChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/notifications/price-drop-notifier', () => ({
  notifyPriceDropWatchers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/price-alert-processor', () => ({
  processPriceAlerts: vi.fn().mockResolvedValue(undefined),
  processBackInStockAlerts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('@twicely/search/typesense-index', () => ({
  upsertListingDocument: vi.fn().mockResolvedValue(undefined),
  deleteListingDocument: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notifications/followed-seller-notifier', () => ({
  notifyFollowedSellerNewListing: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/crosslister/services/outbound-sync', () => ({
  detectOutboundSyncNeeded: vi.fn().mockResolvedValue([]),
  queueOutboundSync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { createListing } from '../listings-create';
import { updateListing } from '../listings-update';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

const mockAuthorize = vi.mocked(authorize);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);
const mockDbDelete = vi.mocked(db.delete);
const mockDbSelect = vi.mocked(db.select);

const SELLER_ID = 'cm1user0000000000000000001';
const LISTING_ID = 'cm1list0000000000000000001';

const baseFormData = {
  title: 'Large Couch',
  description: 'A big couch',
  category: null,
  condition: 'GOOD' as const,
  brand: '',
  tags: [],
  images: [],
  quantity: 1,
  priceCents: 10000,
  originalPriceCents: null,
  cogsCents: null,
  allowOffers: false,
  autoAcceptOfferCents: null,
  autoDeclineOfferCents: null,
  freeShipping: false,
  shippingCents: 0,
  weightOz: null,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  fulfillmentType: 'LOCAL_ONLY' as const,
  localPickupRadiusMiles: 25,
  localHandlingFlags: ['NEEDS_VEHICLE', 'NEEDS_HELP'],
  videoUrl: null,
  videoThumbUrl: null,
  videoDurationSeconds: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorize.mockResolvedValue({
    ability: { can: vi.fn().mockReturnValue(true) } as never,
    session: { userId: SELLER_ID, delegationId: null } as never,
  });
});

describe('createListing — localHandlingFlags', () => {
  it('createListing with LOCAL_ONLY persists handling flags', async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-item-abc123' }]),
    });
    mockDbInsert.mockReturnValue({ values: valuesMock } as never);

    await createListing(baseFormData, 'ACTIVE');

    const insertValues = valuesMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(insertValues).toBeDefined();
    expect(insertValues?.localHandlingFlags).toEqual(['NEEDS_VEHICLE', 'NEEDS_HELP']);
  });

  it('createListing with SHIP_ONLY saves empty array even if flags provided', async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-item-abc123' }]),
    });
    mockDbInsert.mockReturnValue({ values: valuesMock } as never);

    await createListing(
      { ...baseFormData, fulfillmentType: 'SHIP_ONLY', localHandlingFlags: ['NEEDS_VEHICLE'] },
      'ACTIVE'
    );

    const insertValues = valuesMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(insertValues).toBeDefined();
    expect(insertValues?.localHandlingFlags).toEqual([]);
  });
});

describe('updateListing — localHandlingFlags', () => {
  it('updateListing with SHIP_AND_LOCAL persists handling flags', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: LISTING_ID, ownerUserId: SELLER_ID, status: 'ACTIVE', priceCents: 10000 },
          ]),
        }),
      }),
    } as never);

    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-item-abc123' }]),
      }),
    });
    mockDbUpdate.mockReturnValue({ set: setMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    await updateListing(
      LISTING_ID,
      { ...baseFormData, fulfillmentType: 'SHIP_AND_LOCAL', localHandlingFlags: ['NEEDS_EQUIPMENT'] },
      'ACTIVE'
    );

    const setValues = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(setValues).toBeDefined();
    expect(setValues?.localHandlingFlags).toEqual(['NEEDS_EQUIPMENT']);
  });

  it('updateListing changing LOCAL_ONLY to SHIP_ONLY clears flags', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: LISTING_ID, ownerUserId: SELLER_ID, status: 'DRAFT', priceCents: 10000 },
          ]),
        }),
      }),
    } as never);

    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-item-abc123' }]),
      }),
    });
    mockDbUpdate.mockReturnValue({ set: setMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    await updateListing(
      LISTING_ID,
      { ...baseFormData, fulfillmentType: 'SHIP_ONLY', localHandlingFlags: ['NEEDS_VEHICLE'] },
      'ACTIVE'
    );

    const setValues = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(setValues).toBeDefined();
    expect(setValues?.localHandlingFlags).toEqual([]);
  });
});
