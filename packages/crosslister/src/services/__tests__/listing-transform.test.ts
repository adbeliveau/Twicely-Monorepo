import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock channel-registry so tests don't need real DB
vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY',
    displayName: 'eBay',
    tier: 'A',
    defaultCapabilities: {
      maxTitleLength: 80,
      maxDescriptionLength: 4000,
      maxImagesPerListing: 24,
      canPublish: true,
      canImport: true,
      canUpdate: true,
      canDelist: true,
      hasWebhooks: true,
      hasStructuredCategories: true,
      canAutoRelist: true,
      canMakeOffers: true,
      canShare: false,
      supportedImageFormats: ['jpg'],
    },
  }),
}));

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lst-1',
    title: 'Nike Air Jordan',
    description: 'Great shoes',
    priceCents: 10000,
    condition: 'LIKE_NEW',
    brand: 'Nike',
    quantity: 1,
    weightOz: 16,
    lengthIn: 12,
    widthIn: 8,
    heightIn: 4,
    freeShipping: false,
    shippingCents: 500,
    attributesJson: { size: '10', color: 'red' },
    categoryId: 'cat-1',
    ...overrides,
  };
}

function makeImages(count: number = 2) {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/img${i}.jpg`,
    position: i,
    isPrimary: i === 0,
  }));
}

describe('transformListingForChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transforms listing with all fields populated', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(2),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: { externalCategoryId: '12345', externalCategoryName: 'Shoes', path: ['Clothing', 'Shoes'] },
    });
    expect(result.title).toBe('Nike Air Jordan');
    expect(result.priceCents).toBe(10000);
    expect(result.images).toHaveLength(2);
    expect(result.category.externalCategoryId).toBe('12345');
  });

  it('applies title override when set', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(),
      channel: 'EBAY',
      overrides: { titleOverride: 'Custom Title' },
      categoryMapping: null,
    });
    expect(result.title).toBe('Custom Title');
  });

  it('applies description override when set', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(),
      channel: 'EBAY',
      overrides: { descriptionOverride: 'Custom desc' },
      categoryMapping: null,
    });
    expect(result.description).toContain('Custom desc');
  });

  it('applies price override when set in cents', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(),
      channel: 'EBAY',
      overrides: { priceCentsOverride: 5000 },
      categoryMapping: null,
    });
    expect(result.priceCents).toBe(5000);
  });

  it('truncates title to channel max length', async () => {
    const { getChannelMetadata } = await import('@/lib/crosslister/channel-registry');
    (getChannelMetadata as ReturnType<typeof vi.fn>).mockReturnValue({
      channel: 'EBAY',
      displayName: 'eBay',
      tier: 'A',
      defaultCapabilities: { maxTitleLength: 10, maxDescriptionLength: 4000, maxImagesPerListing: 24 },
    });
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing({ title: 'A'.repeat(50) }),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.title.length).toBeLessThanOrEqual(10);
  });

  it('limits images to channel max count', async () => {
    const { getChannelMetadata } = await import('@/lib/crosslister/channel-registry');
    (getChannelMetadata as ReturnType<typeof vi.fn>).mockReturnValue({
      channel: 'DEPOP',
      displayName: 'Depop',
      tier: 'B',
      defaultCapabilities: { maxTitleLength: 80, maxDescriptionLength: 1000, maxImagesPerListing: 4 },
    });
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(10),
      channel: 'DEPOP',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.images.length).toBeLessThanOrEqual(4);
  });

  it('orders images by position', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const images = [
      { url: 'https://example.com/img2.jpg', position: 2, isPrimary: false },
      { url: 'https://example.com/img0.jpg', position: 0, isPrimary: true },
      { url: 'https://example.com/img1.jpg', position: 1, isPrimary: false },
    ];
    const result = transformListingForChannel({
      listing: makeListing(),
      images,
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.images[0]!.url).toBe('https://example.com/img0.jpg');
    expect(result.images[1]!.url).toBe('https://example.com/img1.jpg');
    expect(result.images[2]!.url).toBe('https://example.com/img2.jpg');
  });

  it('marks first image as primary', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(3),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.images[0]!.isPrimary).toBe(true);
    expect(result.images[1]!.isPrimary).toBe(false);
  });

  it('maps freeShipping true to type FREE', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing({ freeShipping: true }),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.shipping.type).toBe('FREE');
    expect(result.shipping.flatRateCents).toBeNull();
  });

  it('maps flat rate shipping to type FLAT with cents', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing({ freeShipping: false, shippingCents: 750 }),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.shipping.type).toBe('FLAT');
    expect(result.shipping.flatRateCents).toBe(750);
  });

  it('falls back to empty category when no mapping exists', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.category.externalCategoryId).toBe('');
    expect(result.category.externalCategoryName).toBe('');
  });

  it('uses canonical values when no overrides set', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing(),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.title).toBe('Nike Air Jordan');
    expect(result.priceCents).toBe(10000);
    expect(result.brand).toBe('Nike');
  });

  it('handles null description gracefully', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing({ description: null }),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.description).toBeDefined();
    expect(typeof result.description).toBe('string');
  });

  it('handles null condition gracefully', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing({ condition: null }),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.condition).toBe('');
  });

  it('generates descriptionHtml for eBay channel', async () => {
    const { transformListingForChannel } = await import('../listing-transform');
    const result = transformListingForChannel({
      listing: makeListing({ description: 'Test desc' }),
      images: makeImages(),
      channel: 'EBAY',
      overrides: null,
      categoryMapping: null,
    });
    expect(result.descriptionHtml).not.toBeNull();
    expect(result.descriptionHtml).toContain('<p>');
  });
});
