/**
 * C1.4 — Market Price Index (Deal Badges)
 *
 * Computes deal badges for listings:
 * - GREAT_PRICE: Price in bottom 20% for category + condition + brand
 * - PRICE_DROP: Price recently reduced
 * - FAST_SELLER: Seller's avg days to sell < 7
 * - LAST_ONE: Only listing of this item on platform
 *
 * Minimum sample size: 20 for market intelligence display
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';

export type DealBadgeType = 'GREAT_PRICE' | 'PRICE_DROP' | 'FAST_SELLER' | 'LAST_ONE' | null;

export interface MarketSummary {
  categoryId: string;
  condition: string;
  brand: string | null;
  sampleSize: number;
  medianPriceCents: number;
  percentile20PriceCents: number;  // Price at 20th percentile
  avgDaysToSell: number;
}

export interface ListingContext {
  listingId: string;
  priceCents: number;
  categoryId: string | null;
  condition: string;
  brand: string | null;
  sellerId: string;
  sellerAvgDaysToSell: number | null;
  hasPriceDropRecent: boolean;       // Price dropped in last 7 days
  isOnlyListingOfType: boolean;      // No other active listings match category+brand
}

export interface DealBadgeResult {
  badge: DealBadgeType;
  reason: string | null;
  metadata: {
    isGreatPrice: boolean;
    isPriceDrop: boolean;
    isFastSeller: boolean;
    isLastOne: boolean;
  };
}

interface DealBadgeConfig {
  minSampleSize: number;
  fastSellerDays: number;
  greatPricePercentile: number;
  priceDropWindowDays: number;
}

/** Load deal badge config from platform_settings. */
async function getDealBadgeConfig(): Promise<DealBadgeConfig> {
  const [minSampleSize, fastSellerDays, greatPricePercentile, priceDropWindowDays] = await Promise.all([
    getPlatformSetting<number>('dealBadge.minSampleSize', 20),
    getPlatformSetting<number>('dealBadge.fastSellerDays', 7),
    getPlatformSetting<number>('dealBadge.greatPricePercentile', 0.20),
    getPlatformSetting<number>('dealBadge.priceDropWindowDays', 7),
  ]);
  return { minSampleSize, fastSellerDays, greatPricePercentile, priceDropWindowDays };
}

/** Exported for use in market intelligence queries. */
export async function getGreatPricePercentile(): Promise<number> {
  return getPlatformSetting<number>('dealBadge.greatPricePercentile', 0.20);
}

/** Exported for use in price drop detection queries. */
export async function getPriceDropWindowDays(): Promise<number> {
  return getPlatformSetting<number>('dealBadge.priceDropWindowDays', 7);
}

/**
 * Compute deal badge for a listing.
 * Priority: GREAT_PRICE > PRICE_DROP > FAST_SELLER > LAST_ONE
 */
export async function computeDealBadge(
  listing: ListingContext,
  marketSummary: MarketSummary | null
): Promise<DealBadgeResult> {
  const config = await getDealBadgeConfig();
  const metadata = {
    isGreatPrice: false,
    isPriceDrop: false,
    isFastSeller: false,
    isLastOne: false,
  };

  // Check GREAT_PRICE (requires market data with sufficient sample)
  if (marketSummary && marketSummary.sampleSize >= config.minSampleSize) {
    if (listing.priceCents <= marketSummary.percentile20PriceCents) {
      metadata.isGreatPrice = true;
    }
  }

  // Check PRICE_DROP
  if (listing.hasPriceDropRecent) {
    metadata.isPriceDrop = true;
  }

  // Check FAST_SELLER
  if (listing.sellerAvgDaysToSell !== null && listing.sellerAvgDaysToSell < config.fastSellerDays) {
    metadata.isFastSeller = true;
  }

  // Check LAST_ONE
  if (listing.isOnlyListingOfType) {
    metadata.isLastOne = true;
  }

  // Return highest priority badge
  if (metadata.isGreatPrice) {
    return {
      badge: 'GREAT_PRICE',
      reason: 'Priced in bottom 20% for similar items',
      metadata,
    };
  }

  if (metadata.isPriceDrop) {
    return {
      badge: 'PRICE_DROP',
      reason: 'Price recently reduced',
      metadata,
    };
  }

  if (metadata.isFastSeller) {
    return {
      badge: 'FAST_SELLER',
      reason: `Seller typically sells within ${config.fastSellerDays} days`,
      metadata,
    };
  }

  if (metadata.isLastOne) {
    return {
      badge: 'LAST_ONE',
      reason: 'Only listing of this item',
      metadata,
    };
  }

  return {
    badge: null,
    reason: null,
    metadata,
  };
}

/**
 * Get human-readable badge label.
 */
export function getDealBadgeLabel(badge: DealBadgeType): string | null {
  switch (badge) {
    case 'GREAT_PRICE':
      return 'Great Price';
    case 'PRICE_DROP':
      return 'Price Drop';
    case 'FAST_SELLER':
      return 'Sells Fast';
    case 'LAST_ONE':
      return 'Last One';
    default:
      return null;
  }
}

/**
 * Get badge color class for UI.
 */
export function getDealBadgeColor(badge: DealBadgeType): string {
  switch (badge) {
    case 'GREAT_PRICE':
      return 'bg-green-100 text-green-800';
    case 'PRICE_DROP':
      return 'bg-blue-100 text-blue-800';
    case 'FAST_SELLER':
      return 'bg-purple-100 text-purple-800';
    case 'LAST_ONE':
      return 'bg-orange-100 text-orange-800';
    default:
      return '';
  }
}

/**
 * Check if market data has sufficient sample size.
 */
export async function hasMinimumSampleSize(sampleSize: number): Promise<boolean> {
  const minSampleSize = await getPlatformSetting<number>('dealBadge.minSampleSize', 20);
  return sampleSize >= minSampleSize;
}
