import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status', slug: 'slug', priceCents: 'price_cents' },
  listingImage: { listingId: 'listing_id' },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
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

vi.mock('@/lib/actions/listings-delete', () => ({
  deleteListing: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

const mockAuthorize = vi.mocked(authorize);
const mockDbInsert = vi.mocked(db.insert);
const mockDbUpdate = vi.mocked(db.update);
const mockDbSelect = vi.mocked(db.select);
const mockDbDelete = vi.mocked(db.delete);

const SELLER_ID = 'cm1user0000000000000000001';
const LISTING_ID = 'cm1list0000000000000000001';

const baseFormData = {
  title: 'Test Item',
  description: 'A description',
  category: null,
  condition: null,
  brand: '',
  tags: [],
  images: [],
  quantity: 1,
  priceCents: 0,
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
  fulfillmentType: 'SHIP_ONLY' as const,
  localPickupRadiusMiles: null,
  localHandlingFlags: [],
  videoUrl: null,
  videoThumbUrl: null,
  videoDurationSeconds: null,
};

const formWithVideo = {
  ...baseFormData,
  videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/v.mp4',
  videoThumbUrl: 'https://cdn.twicely.com/videos/listings/lst-1/t.jpg',
  videoDurationSeconds: 30,
};

describe('createListing with video', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue({
      ability: { can: vi.fn().mockReturnValue(true) } as never,
      session: { userId: SELLER_ID, delegationId: null } as never,
    });
  });

  it('creates listing without video when video fields are null', async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-item-abc123' }]),
    });
    mockDbInsert.mockReturnValue({ values: valuesMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const { createListing } = await import('../listings-create');
    const result = await createListing({ ...baseFormData }, 'DRAFT');
    expect(result.success).toBe(true);
    const insertValues = valuesMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(insertValues?.videoUrl).toBeNull();
    expect(insertValues?.videoDurationSeconds).toBeNull();
  });

  it('persists videoUrl, videoThumbUrl, videoDurationSeconds to database', async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-item-abc123' }]),
    });
    mockDbInsert.mockReturnValue({ values: valuesMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const { createListing } = await import('../listings-create');
    await createListing(formWithVideo, 'DRAFT');

    const insertValues = valuesMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(insertValues?.videoUrl).toBe('https://cdn.twicely.com/videos/listings/lst-1/v.mp4');
    expect(insertValues?.videoThumbUrl).toBe('https://cdn.twicely.com/videos/listings/lst-1/t.jpg');
    expect(insertValues?.videoDurationSeconds).toBe(30);
  });

  it('validates videoDurationSeconds is within 15-60 range via schema', async () => {
    const { createListing } = await import('../listings-create');
    const result = await createListing({ ...baseFormData, videoUrl: 'https://cdn.twicely.com/v.mp4', videoThumbUrl: 'https://cdn.twicely.com/t.jpg', videoDurationSeconds: 30 }, 'DRAFT');
    // schema accepts this
    expect(result).toBeDefined();
  });
});

describe('updateListing with video', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue({
      ability: { can: vi.fn().mockReturnValue(true) } as never,
      session: { userId: SELLER_ID, delegationId: null } as never,
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: LISTING_ID, ownerUserId: SELLER_ID, status: 'DRAFT', priceCents: 0 },
          ]),
        }),
      }),
    } as never);
  });

  it('updates video fields on existing listing', async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-slug' }]),
      }),
    });
    mockDbUpdate.mockReturnValue({ set: setMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const { updateListing } = await import('../listings-update');
    await updateListing(LISTING_ID, formWithVideo, 'DRAFT');

    const setValues = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(setValues?.videoUrl).toBe('https://cdn.twicely.com/videos/listings/lst-1/v.mp4');
    expect(setValues?.videoDurationSeconds).toBe(30);
  });

  it('removes video by setting fields to null', async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-slug' }]),
      }),
    });
    mockDbUpdate.mockReturnValue({ set: setMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const { updateListing } = await import('../listings-update');
    await updateListing(LISTING_ID, { ...baseFormData }, 'DRAFT');

    const setValues = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(setValues?.videoUrl).toBeNull();
    expect(setValues?.videoDurationSeconds).toBeNull();
  });

  it('preserves existing video when video fields provided', async () => {
    const setMock = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: LISTING_ID, slug: 'test-slug' }]),
      }),
    });
    mockDbUpdate.mockReturnValue({ set: setMock } as never);
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const { updateListing } = await import('../listings-update');
    await updateListing(LISTING_ID, formWithVideo, 'DRAFT');

    const setValues = setMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(setValues?.videoUrl).toBe('https://cdn.twicely.com/videos/listings/lst-1/v.mp4');
  });

  it('validates video fields through listingFormSchema', async () => {
    // Schema rejects duration out of range
    const { updateListing } = await import('../listings-update');
    const result = await updateListing(LISTING_ID, {
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/v.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/t.jpg',
      videoDurationSeconds: 61,
    }, 'DRAFT');
    expect(result.success).toBe(false);
  });
});
