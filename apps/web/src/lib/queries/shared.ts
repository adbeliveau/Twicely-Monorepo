import type { ListingCardData } from '@/types/listings';

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
