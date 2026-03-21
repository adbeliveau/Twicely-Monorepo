import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelPolicyRule: {
    channel: 'channel',
    isActive: 'isActive',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY',
    displayName: 'eBay',
    tier: 'A',
    defaultCapabilities: {
      maxTitleLength: 80,
      maxDescriptionLength: 4000,
      maxImagesPerListing: 24,
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
    attributesJson: {},
    categoryId: 'cat-1',
    ownerUserId: 'user-1',
    status: 'ACTIVE',
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

async function mockDbNoRules() {
  const { db } = await import('@/lib/db');
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  });
}

async function mockDbWithRules(rules: unknown[]) {
  const { db } = await import('@/lib/db');
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rules),
  });
}

describe('validateForChannel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns ALLOW for a valid listing', async () => {
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing(), makeImages(2), 'EBAY');
    expect(result.status).toBe('ALLOW');
  });

  it('returns DENY when title is empty', async () => {
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing({ title: '' }), makeImages(2), 'EBAY');
    expect(result.status).toBe('DENY');
    if (result.status === 'DENY') {
      expect(result.reason).toContain('title');
    }
  });

  it('returns DENY when title is null', async () => {
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing({ title: null }), makeImages(2), 'EBAY');
    expect(result.status).toBe('DENY');
  });

  it('returns DENY when no images', async () => {
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing(), [], 'EBAY');
    expect(result.status).toBe('DENY');
    if (result.status === 'DENY') {
      expect(result.reason).toContain('image');
    }
  });

  it('returns DENY when price is zero', async () => {
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing({ priceCents: 0 }), makeImages(2), 'EBAY');
    expect(result.status).toBe('DENY');
    if (result.status === 'DENY') {
      expect(result.reason).toContain('Price');
    }
  });

  it('returns DENY when price is negative', async () => {
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing({ priceCents: -100 }), makeImages(2), 'EBAY');
    expect(result.status).toBe('DENY');
  });

  it('returns REQUIRE_CHANGES when title exceeds channel max length', async () => {
    const { getChannelMetadata } = await import('@/lib/crosslister/channel-registry');
    (getChannelMetadata as ReturnType<typeof vi.fn>).mockReturnValue({
      channel: 'EBAY',
      displayName: 'eBay',
      defaultCapabilities: { maxTitleLength: 10, maxDescriptionLength: 4000, maxImagesPerListing: 24 },
    });
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(
      makeListing({ title: 'A'.repeat(50) }),
      makeImages(2),
      'EBAY',
    );
    expect(result.status).toBe('REQUIRE_CHANGES');
    if (result.status === 'REQUIRE_CHANGES') {
      expect(result.changes.some((c) => c.field === 'title')).toBe(true);
    }
  });

  it('returns REQUIRE_CHANGES when too many images', async () => {
    const { getChannelMetadata } = await import('@/lib/crosslister/channel-registry');
    (getChannelMetadata as ReturnType<typeof vi.fn>).mockReturnValue({
      channel: 'DEPOP',
      displayName: 'Depop',
      defaultCapabilities: { maxTitleLength: 80, maxDescriptionLength: 1000, maxImagesPerListing: 4 },
    });
    await mockDbNoRules();
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing(), makeImages(8), 'DEPOP');
    expect(result.status).toBe('REQUIRE_CHANGES');
    if (result.status === 'REQUIRE_CHANGES') {
      expect(result.changes.some((c) => c.field === 'images')).toBe(true);
    }
  });

  it('returns DENY when DB policy rule has BLOCK severity and fails', async () => {
    await mockDbWithRules([
      {
        field: 'brand',
        severity: 'BLOCK',
        constraintJson: { op: 'required', field: 'brand' },
        guidance: 'Brand is required for eBay',
        isActive: true,
        channel: 'EBAY',
      },
    ]);
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing({ brand: null }), makeImages(2), 'EBAY');
    expect(result.status).toBe('DENY');
    if (result.status === 'DENY') {
      expect(result.reason).toContain('Brand');
    }
  });

  it('returns REQUIRE_CHANGES when DB policy rule has WARN severity and fails', async () => {
    await mockDbWithRules([
      {
        field: 'brand',
        severity: 'WARN',
        constraintJson: { op: 'required', field: 'brand' },
        guidance: 'Brand recommended for eBay',
        isActive: true,
        channel: 'EBAY',
      },
    ]);
    const { validateForChannel } = await import('../policy-validator');
    const result = await validateForChannel(makeListing({ brand: null }), makeImages(2), 'EBAY');
    expect(result.status).toBe('REQUIRE_CHANGES');
  });
});
