/** Alert trigger types for price monitoring */
export type PriceAlertType = 'BELOW_TARGET' | 'PERCENT_DROP' | 'ANY_DROP';

/** Input for creating/updating a buyer collection */
export interface CollectionInput {
  name: string;
  description?: string | null;
  isPublic?: boolean;
}

/** Reasons a listing appears in a recommendation feed */
export type RecommendationReason =
  | 'SIMILAR_TO_VIEWED'
  | 'SIMILAR_TO_PURCHASED'
  | 'TRENDING'
  | 'PRICE_DROP'
  | 'NEW_FROM_FOLLOWED';

/** Input for upserting buyer preferences */
export interface PreferenceInput {
  preferredCategories?: string[];
  preferredBrands?: string[];
  preferredSizes?: Record<string, string>;
  priceRangeMinCents?: number | null;
  priceRangeMaxCents?: number | null;
}

/** Aggregated price statistics for a listing */
export interface PriceStats {
  minCents: number;
  maxCents: number;
  avgCents: number;
  currentCents: number;
  percentChange30d: number | null;
}

/** Pagination options */
export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

/** Standard paginated response */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Moderation action type */
export type ModerationAction = 'APPROVED' | 'REJECTED';

/** Review moderation stats */
export interface ReviewModerationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}
