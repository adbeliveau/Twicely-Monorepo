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
  /** Card emphasis variant from personalization layer. Null for non-personalized views. */
  cardEmphasis?: 'social' | 'specs' | 'collectible' | 'default' | null;
  /** Fulfillment type from listing (for local pickup badge). */
  fulfillmentType?: string;
  /** Approximate distance in miles from buyer location (Decision #144). */
  distanceMiles?: number;
  /** Seller city-level latitude (Decision #144). */
  sellerLat?: number;
  /** Seller city-level longitude (Decision #144). */
  sellerLng?: number;
}

export interface ListingDetailData {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  originalPriceCents: number | null;
  condition: string;
  brand: string | null;
  freeShipping: boolean;
  shippingCents: number;
  allowOffers: boolean;
  autoAcceptOfferCents: number | null;
  autoDeclineOfferCents: number | null;
  quantity: number;
  availableQuantity: number | null;
  tags: string[];
  attributesJson: Record<string, unknown>;
  status: string;
  fulfillmentType: string;
  localHandlingFlags: string[];
  activatedAt: Date | null;
  soldAt: Date | null;
  createdAt: Date;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }>;
  seller: {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    storeName: string | null;
    storeSlug: string | null;
    averageRating: number | null;
    totalReviews: number;
    memberSince: Date;
    performanceBand: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
    parent: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
  videoUrl: string | null;
  videoThumbUrl: string | null;
  videoDurationSeconds: number | null;
  /** Seller city-level latitude (Decision #144). */
  sellerLat?: number | null;
  /** Seller city-level longitude (Decision #144). */
  sellerLng?: number | null;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children?: Array<{
    id: string;
    name: string;
    slug: string;
    listingCount: number;
  }>;
}

export interface SearchFilters {
  q?: string;
  categoryId?: string;
  condition?: ('NEW_WITH_TAGS' | 'NEW_WITHOUT_TAGS' | 'NEW_WITH_DEFECTS' | 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD' | 'ACCEPTABLE')[];
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  localPickup?: boolean;
  brand?: string;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'nearest';
  page?: number;
  limit?: number;
  /** Buyer latitude for geo-proximity search (Decision #144). */
  buyerLat?: number;
  /** Buyer longitude for geo-proximity search (Decision #144). */
  buyerLng?: number;
  /** Search radius in miles (Decision #144). */
  radiusMiles?: number;
}

export interface SearchResult {
  listings: ListingCardData[];
  totalCount: number;
  page: number;
  totalPages: number;
  filters: SearchFilters;
}
