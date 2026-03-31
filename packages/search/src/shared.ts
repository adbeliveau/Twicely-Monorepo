export interface SearchFilters {
  q?: string;
  categoryId?: string;
  condition?: ('NEW_WITH_TAGS' | 'NEW_WITHOUT_TAGS' | 'NEW_WITH_DEFECTS' | 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD' | 'ACCEPTABLE')[];
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  brand?: string;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  listings: ListingCardData[];
  totalCount: number;
  page: number;
  totalPages: number;
  filters: SearchFilters;
}

export interface ListingCardData {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  originalPriceCents: number | null;
  condition: string;
  brand: string | null;
  freeShipping: boolean;
  shippingCents: number;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
  sellerName: string;
  sellerUsername: string;
  sellerAvatarUrl: string | null;
  sellerAverageRating: number | null;
  sellerTotalReviews: number;
  sellerShowStars: boolean;
  storefrontCategoryId?: string | null;
  /** True when this listing occupies a promoted slot (D2.4 boost) */
  isBoosted?: boolean;
}

/**
 * Map a database row to ListingCardData.
 * Shared between search/listings.ts and queries/listings.ts.
 */
export function mapToListingCard(row: {
  id: string;
  slug: string | null;
  title: string | null;
  priceCents: number | null;
  originalPriceCents: number | null;
  condition: string | null;
  brand: string | null;
  freeShipping: boolean;
  shippingCents: number;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
  sellerName: string | null;
  sellerUsername: string | null;
  sellerAvatarUrl: string | null;
  sellerAverageRating: number | null;
  sellerTotalReviews: number | null;
  sellerShowStars: boolean | null;
  storefrontCategoryId?: string | null;
}): ListingCardData {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title ?? '',
    priceCents: row.priceCents ?? 0,
    originalPriceCents: row.originalPriceCents,
    condition: row.condition ?? 'GOOD',
    brand: row.brand,
    freeShipping: row.freeShipping,
    shippingCents: row.shippingCents ?? 0,
    primaryImageUrl: row.primaryImageUrl,
    primaryImageAlt: row.primaryImageAlt,
    sellerName: row.sellerName ?? 'Unknown Seller',
    sellerUsername: row.sellerUsername ?? '',
    sellerAvatarUrl: row.sellerAvatarUrl,
    sellerAverageRating: row.sellerAverageRating,
    sellerTotalReviews: row.sellerTotalReviews ?? 0,
    sellerShowStars: row.sellerShowStars ?? false,
    storefrontCategoryId: row.storefrontCategoryId,
  };
}
