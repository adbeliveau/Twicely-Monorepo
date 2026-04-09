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
