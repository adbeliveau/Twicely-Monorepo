import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthorize, mockSub, mockGetPlatformSetting, mockDbInsert,
} = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockSub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
  mockGetPlatformSetting: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: mockSub }));
vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', slug: 'slug', ownerUserId: 'owner_user_id', status: 'status' },
  listingImage: { listingId: 'listing_id', url: 'url', position: 'position', isPrimary: 'is_primary' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@twicely/db', () => ({ db: { insert: mockDbInsert } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/listings/slug', () => ({ generateListingSlug: vi.fn().mockResolvedValue('test-listing-abc123') }));
vi.mock('@/lib/listings/seller-activate', () => ({ ensureSellerProfile: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@twicely/notifications/category-alert-notifier', () => ({
  notifyCategoryAlertMatches: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/notifications/followed-seller-notifier', () => ({
  notifyFollowedSellerNewListing: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/services/price-history-service', () => ({
  recordPriceChange: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('@twicely/search/typesense-index', () => ({
  upsertListingDocument: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/validations/listing', () => ({
  listingFormSchema: {
    safeParse: vi.fn((data: unknown) => ({ success: true, data })),
  },
}));

import { createListing } from '../listings-create';

function makeAbility(canCreate = true) {
  return { can: vi.fn().mockReturnValue(canCreate) };
}

function makeInsertChain(id: string, slug: string) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id, slug }]),
    }),
  };
}

const validData = {
  title: 'Nike Air Jordan 1',
  description: 'Great condition sneakers',
  priceCents: 9999,
  originalPriceCents: null,
  cogsCents: null,
  quantity: 1,
  condition: 'VERY_GOOD' as const,
  brand: 'Nike',
  freeShipping: false,
  shippingCents: 599,
  allowOffers: true,
  autoAcceptOfferCents: null,
  autoDeclineOfferCents: null,
  images: [{ id: 'img-1', url: 'https://cdn.example.com/img.jpg', position: 0 }],
  tags: [],
  category: null,
  fulfillmentType: 'SHIP_ONLY' as const,
  weightOz: null,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  localPickupRadiusMiles: null,
  localHandlingFlags: [],
  videoUrl: null,
  videoThumbUrl: null,
  videoDurationSeconds: null,
};

describe('createListing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: null });
    const result = await createListing(validData, 'DRAFT');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns Forbidden when cannot create Listing', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(false), session: { userId: 'u1', delegationId: null } });
    const result = await createListing(validData, 'DRAFT');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error for invalid status value (not DRAFT or ACTIVE)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    const result = await createListing(validData, 'INVALID' as never);
    expect(result.success).toBe(false);
  });

  it('creates a DRAFT listing successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockGetPlatformSetting
      .mockResolvedValueOnce(100)    // minPriceCents
      .mockResolvedValueOnce(10000000); // maxPriceCents
    mockDbInsert
      .mockReturnValueOnce(makeInsertChain('lst-new', 'nike-air-jordan-abc'))
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });

    const result = await createListing(validData, 'DRAFT');
    expect(result.success).toBe(true);
    expect(result.listingId).toBe('lst-new');
    expect(result.slug).toBe('nike-air-jordan-abc');
  });

  it('returns error when price is below platform minimum', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockGetPlatformSetting
      .mockResolvedValueOnce(500)    // minPriceCents = $5.00
      .mockResolvedValueOnce(10000000);
    const result = await createListing({ ...validData, priceCents: 100 }, 'ACTIVE');
    expect(result.success).toBe(false);
    expect(result.error).toContain('$5.00');
  });

  it('returns error when price exceeds platform maximum', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockGetPlatformSetting
      .mockResolvedValueOnce(100)     // minPriceCents
      .mockResolvedValueOnce(100000); // maxPriceCents = $1000
    const result = await createListing({ ...validData, priceCents: 200000 }, 'ACTIVE');
    expect(result.success).toBe(false);
    expect(result.error).toContain('$1000.00');
  });

  it('skips price validation when priceCents is 0 (unprice DRAFT)', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockDbInsert
      .mockReturnValueOnce(makeInsertChain('lst-draft', 'listing-abc'))
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    const result = await createListing({ ...validData, priceCents: 0 }, 'DRAFT');
    expect(result.success).toBe(true);
    // getPlatformSetting should NOT have been called for price check
    expect(mockGetPlatformSetting).not.toHaveBeenCalled();
  });

  it('creates ACTIVE listing and returns listingId', async () => {
    mockAuthorize.mockResolvedValue({ ability: makeAbility(), session: { userId: 'u1', delegationId: null } });
    mockGetPlatformSetting
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10000000);
    mockDbInsert
      .mockReturnValueOnce(makeInsertChain('lst-active', 'active-listing'))
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    const result = await createListing(validData, 'ACTIVE');
    expect(result.success).toBe(true);
    expect(result.listingId).toBe('lst-active');
  });

  it('uses delegation seller ID (onBehalfOfSellerId) when delegationId is set', async () => {
    mockAuthorize.mockResolvedValue({
      ability: makeAbility(),
      session: { userId: 'staff-1', delegationId: 'del-1', onBehalfOfSellerId: 'seller-2' },
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10000000);
    mockDbInsert
      .mockReturnValueOnce(makeInsertChain('lst-delegated', 'delegated-item'))
      .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) });
    const result = await createListing(validData, 'ACTIVE');
    expect(result.success).toBe(true);
    expect(result.listingId).toBe('lst-delegated');
  });
});
