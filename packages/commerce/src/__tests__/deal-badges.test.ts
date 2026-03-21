import { describe, it, expect, vi } from 'vitest';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import {
  computeDealBadge,
  getDealBadgeLabel,
  getDealBadgeColor,
  hasMinimumSampleSize,
  type MarketSummary,
  type ListingContext,
} from '../deal-badges';

describe('computeDealBadge', () => {
  const baseListingContext: ListingContext = {
    listingId: 'listing-1',
    priceCents: 5000,
    categoryId: 'cat-1',
    condition: 'GOOD',
    brand: 'BrandX',
    sellerId: 'seller-1',
    sellerAvgDaysToSell: 14,
    hasPriceDropRecent: false,
    isOnlyListingOfType: false,
  };

  const marketSummary: MarketSummary = {
    categoryId: 'cat-1',
    condition: 'GOOD',
    brand: 'BrandX',
    sampleSize: 50,
    medianPriceCents: 6000,
    percentile20PriceCents: 4000,
    avgDaysToSell: 10,
  };

  it('returns GREAT_PRICE when price is in bottom 20%', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      priceCents: 3500, // Below 4000 (20th percentile)
    };

    const result = await computeDealBadge(listing, marketSummary);

    expect(result.badge).toBe('GREAT_PRICE');
    expect(result.metadata.isGreatPrice).toBe(true);
  });

  it('returns PRICE_DROP when price recently reduced', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      hasPriceDropRecent: true,
    };

    const result = await computeDealBadge(listing, marketSummary);

    expect(result.badge).toBe('PRICE_DROP');
    expect(result.metadata.isPriceDrop).toBe(true);
  });

  it('returns FAST_SELLER when seller avg days < 7', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      sellerAvgDaysToSell: 5,
    };

    const result = await computeDealBadge(listing, marketSummary);

    expect(result.badge).toBe('FAST_SELLER');
    expect(result.metadata.isFastSeller).toBe(true);
  });

  it('returns LAST_ONE when only listing of type', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      isOnlyListingOfType: true,
    };

    const result = await computeDealBadge(listing, marketSummary);

    expect(result.badge).toBe('LAST_ONE');
    expect(result.metadata.isLastOne).toBe(true);
  });

  it('prioritizes GREAT_PRICE over other badges', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      priceCents: 3500,          // GREAT_PRICE
      hasPriceDropRecent: true,  // PRICE_DROP
      sellerAvgDaysToSell: 5,    // FAST_SELLER
      isOnlyListingOfType: true, // LAST_ONE
    };

    const result = await computeDealBadge(listing, marketSummary);

    expect(result.badge).toBe('GREAT_PRICE');
    // But all flags should be true
    expect(result.metadata.isGreatPrice).toBe(true);
    expect(result.metadata.isPriceDrop).toBe(true);
    expect(result.metadata.isFastSeller).toBe(true);
    expect(result.metadata.isLastOne).toBe(true);
  });

  it('returns null when no badges apply', async () => {
    const result = await computeDealBadge(baseListingContext, marketSummary);

    expect(result.badge).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('ignores market data when sample size < 20', async () => {
    const smallSampleMarket: MarketSummary = {
      ...marketSummary,
      sampleSize: 15,
    };

    const listing: ListingContext = {
      ...baseListingContext,
      priceCents: 3500, // Would be GREAT_PRICE with enough data
    };

    const result = await computeDealBadge(listing, smallSampleMarket);

    expect(result.metadata.isGreatPrice).toBe(false);
  });

  it('handles null market summary', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      priceCents: 1000,
    };

    const result = await computeDealBadge(listing, null);

    expect(result.metadata.isGreatPrice).toBe(false);
    expect(result.badge).toBeNull();
  });

  it('handles null sellerAvgDaysToSell', async () => {
    const listing: ListingContext = {
      ...baseListingContext,
      sellerAvgDaysToSell: null,
    };

    const result = await computeDealBadge(listing, marketSummary);

    expect(result.metadata.isFastSeller).toBe(false);
  });
});

describe('getDealBadgeLabel', () => {
  it('returns correct labels', () => {
    expect(getDealBadgeLabel('GREAT_PRICE')).toBe('Great Price');
    expect(getDealBadgeLabel('PRICE_DROP')).toBe('Price Drop');
    expect(getDealBadgeLabel('FAST_SELLER')).toBe('Sells Fast');
    expect(getDealBadgeLabel('LAST_ONE')).toBe('Last One');
    expect(getDealBadgeLabel(null)).toBeNull();
  });
});

describe('getDealBadgeColor', () => {
  it('returns correct color classes', () => {
    expect(getDealBadgeColor('GREAT_PRICE')).toBe('bg-green-100 text-green-800');
    expect(getDealBadgeColor('PRICE_DROP')).toBe('bg-blue-100 text-blue-800');
    expect(getDealBadgeColor('FAST_SELLER')).toBe('bg-purple-100 text-purple-800');
    expect(getDealBadgeColor('LAST_ONE')).toBe('bg-orange-100 text-orange-800');
    expect(getDealBadgeColor(null)).toBe('');
  });
});

describe('hasMinimumSampleSize', () => {
  it('returns true for sample size >= 20', async () => {
    expect(await hasMinimumSampleSize(20)).toBe(true);
    expect(await hasMinimumSampleSize(100)).toBe(true);
  });

  it('returns false for sample size < 20', async () => {
    expect(await hasMinimumSampleSize(19)).toBe(false);
    expect(await hasMinimumSampleSize(0)).toBe(false);
  });
});
