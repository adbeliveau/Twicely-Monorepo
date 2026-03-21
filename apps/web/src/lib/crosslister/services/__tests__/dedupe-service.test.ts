import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFingerprint } from '../dedupe-service';
import type { ExternalListing } from '../../types';

// Use vi.hoisted to declare mocks that can be referenced in vi.mock factories
const mocks = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  return { mockDbSelect };
});

vi.mock('@twicely/db', () => ({
  db: { select: mocks.mockDbSelect },
}));
vi.mock('@twicely/db/schema', () => ({
  dedupeFingerprint: {
    sellerId: 'seller_id',
    compositeHash: 'composite_hash',
    titleHash: 'title_hash',
    priceRange: 'price_range',
    listingId: 'listing_id',
  },
}));

function buildListing(overrides: Partial<ExternalListing> = {}): ExternalListing {
  return {
    externalId: 'SKU-001',
    title: 'Nike Air Jordan 1 Retro High OG Chicago',
    description: 'Great shoes',
    priceCents: 15000,
    currencyCode: 'USD',
    quantity: 1,
    condition: 'LIKE_NEW',
    category: 'Shoes',
    brand: 'Nike',
    images: [{ url: 'https://example.com/img.jpg', isPrimary: true, sortOrder: 0 }],
    itemSpecifics: {},
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
    url: 'https://www.ebay.com/itm/123',
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    ...overrides,
  };
}

describe('generateFingerprint', () => {
  it('generates consistent fingerprint for same input', () => {
    const listing = buildListing();
    const fp1 = generateFingerprint(listing, 'seller-1');
    const fp2 = generateFingerprint(listing, 'seller-1');
    expect(fp1.titleHash).toBe(fp2.titleHash);
    expect(fp1.compositeHash).toBe(fp2.compositeHash);
    expect(fp1.priceRange).toBe(fp2.priceRange);
  });

  it('generates different fingerprints for different titles', () => {
    const fp1 = generateFingerprint(buildListing({ title: 'Nike Shoes' }), 'seller-1');
    const fp2 = generateFingerprint(buildListing({ title: 'Adidas Sneakers' }), 'seller-1');
    expect(fp1.titleHash).not.toBe(fp2.titleHash);
    expect(fp1.compositeHash).not.toBe(fp2.compositeHash);
  });

  it('assigns correct price range: 0-999 for < $10', () => {
    const fp = generateFingerprint(buildListing({ priceCents: 500 }), 'seller-1');
    expect(fp.priceRange).toBe('0-999');
  });

  it('assigns correct price range: 1000-2499', () => {
    const fp = generateFingerprint(buildListing({ priceCents: 1500 }), 'seller-1');
    expect(fp.priceRange).toBe('1000-2499');
  });

  it('assigns correct price range: 10000+ for priceCents >= 10000', () => {
    const fp = generateFingerprint(buildListing({ priceCents: 15000 }), 'seller-1');
    expect(fp.priceRange).toBe('10000+');
  });

  it('imageHash is always null (pHash deferred)', () => {
    const fp = generateFingerprint(buildListing(), 'seller-1');
    expect(fp.imageHash).toBeNull();
  });

  it('handles missing brand gracefully', () => {
    const fp = generateFingerprint(buildListing({ brand: null }), 'seller-1');
    expect(fp.compositeHash).toBeDefined();
    expect(fp.compositeHash.length).toBeGreaterThan(0);
  });

  it('handles missing category gracefully', () => {
    const fp = generateFingerprint(buildListing({ category: null }), 'seller-1');
    expect(fp.compositeHash).toBeDefined();
  });
});

describe('findDedupeMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds exact compositeHash match (strong match >= 90%)', async () => {
    const listing = buildListing();
    const fp = generateFingerprint(listing, 'seller-1');

    mocks.mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ listingId: 'listing-123' }]) }),
      }),
    });

    const { findDedupeMatch } = await import('../dedupe-service');
    const result = await findDedupeMatch(fp, 'seller-1');
    expect(result.matchListingId).toBe('listing-123');
    expect(result.confidence).toBe(95);
  });

  it('finds titleHash-only match (weak match, 70-89%)', async () => {
    const listing = buildListing();
    const fp = generateFingerprint(listing, 'seller-1');

    // No composite match
    mocks.mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });
    // Title match with different price range
    mocks.mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ listingId: 'listing-456', priceRange: '0-999' }]) }),
      }),
    });

    const { findDedupeMatch } = await import('../dedupe-service');
    const result = await findDedupeMatch(fp, 'seller-1');
    expect(result.matchListingId).toBe('listing-456');
    expect(result.confidence).toBe(75); // title only (different price range)
  });

  it('returns no match for completely different listings', async () => {
    const fp = generateFingerprint(buildListing({ title: 'Completely Different Item', brand: 'Unknown' }), 'seller-1');

    mocks.mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });
    mocks.mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });

    const { findDedupeMatch } = await import('../dedupe-service');
    const result = await findDedupeMatch(fp, 'seller-1');
    expect(result.matchListingId).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
