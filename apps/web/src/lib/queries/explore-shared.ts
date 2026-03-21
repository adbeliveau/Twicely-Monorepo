import {
  listing,
  listingImage,
  user,
  sellerPerformance,
} from '@twicely/db/schema';
import type { ListingCardData } from '@/types/listings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExploreCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  listings: ListingCardData[];
}

export interface RisingSellerData {
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  avatarUrl: string | null;
  performanceBand: string;
  listingCount: number;
  followerCount: number;
  memberSince: Date;
}

// ─── Shared listing card field selection ─────────────────────────────────────

export const listingCardFields = {
  id: listing.id,
  slug: listing.slug,
  title: listing.title,
  priceCents: listing.priceCents,
  originalPriceCents: listing.originalPriceCents,
  condition: listing.condition,
  brand: listing.brand,
  freeShipping: listing.freeShipping,
  shippingCents: listing.shippingCents,
  primaryImageUrl: listingImage.url,
  primaryImageAlt: listingImage.altText,
  sellerName: user.displayName,
  sellerUsername: user.username,
  sellerAvatarUrl: user.avatarUrl,
  sellerAverageRating: sellerPerformance.averageRating,
  sellerTotalReviews: sellerPerformance.totalReviews,
  sellerShowStars: sellerPerformance.showStars,
};
