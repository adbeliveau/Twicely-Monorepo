import { db } from '@twicely/db';
import { review, sellerPerformance, sellerProfile, user, reviewResponse } from '@twicely/db/schema';
import { eq, and, desc, sql, or, isNull, lte } from 'drizzle-orm';

/**
 * Seller review summary data (from sellerPerformance table).
 */
export interface SellerReviewSummary {
  averageRating: number | null;
  displayStars: number | null;
  totalReviews: number;
  currentBand: string;
  trustBadge: string | null;
  trustBadgeSecondary: string | null;
  showStars: boolean;
}

/**
 * Single review data for display.
 */
export interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  photos: string[];
  dsrItemAsDescribed: number | null;
  dsrShippingSpeed: number | null;
  dsrCommunication: number | null;
  dsrPackaging: number | null;
  createdAt: Date;
  isVerifiedPurchase: boolean;
  reviewerDisplayName: string; // First name + last initial
  reviewerAvatarUrl: string | null;
  response: {
    id: string;
    body: string;
    createdAt: Date;
  } | null;
}

/**
 * Paginated reviews result.
 */
export interface PaginatedReviews {
  reviews: ReviewData[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * DSR averages for a seller.
 */
export interface SellerDSRAverages {
  avgItemAsDescribed: number | null;
  avgShippingSpeed: number | null;
  avgCommunication: number | null;
  avgPackaging: number | null;
}

/**
 * Get seller review summary (aggregate data from sellerPerformance).
 *
 * Maps userId → sellerProfileId to query sellerPerformance table.
 */
export async function getSellerReviewSummary(sellerId: string): Promise<SellerReviewSummary | null> {
  // Get sellerProfileId from userId
  const [profile] = await db
    .select({ id: sellerProfile.id })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, sellerId))
    .limit(1);

  if (!profile) {
    return null;
  }

  // Fetch seller performance data
  const [performance] = await db
    .select({
      averageRating: sellerPerformance.averageRating,
      displayStars: sellerPerformance.displayStars,
      totalReviews: sellerPerformance.totalReviews,
      currentBand: sellerPerformance.currentBand,
      trustBadge: sellerPerformance.trustBadge,
      trustBadgeSecondary: sellerPerformance.trustBadgeSecondary,
      showStars: sellerPerformance.showStars,
    })
    .from(sellerPerformance)
    .where(eq(sellerPerformance.sellerProfileId, profile.id))
    .limit(1);

  if (!performance) {
    return null;
  }

  return {
    averageRating: performance.averageRating,
    displayStars: performance.displayStars,
    totalReviews: performance.totalReviews,
    currentBand: performance.currentBand,
    trustBadge: performance.trustBadge,
    trustBadgeSecondary: performance.trustBadgeSecondary,
    showStars: performance.showStars,
  };
}

/**
 * Get paginated reviews for a seller.
 *
 * Returns APPROVED reviews only, ordered by createdAt DESC.
 * Includes reviewer display name (first name + last initial) and seller response if exists.
 */
export async function getSellerReviews(
  sellerId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<PaginatedReviews> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  // Get total count (dual-blind: only visible reviews)
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(review)
    .where(and(
      eq(review.sellerId, sellerId),
      eq(review.status, 'APPROVED'),
      or(isNull(review.visibleAt), lte(review.visibleAt, sql`NOW()`))
    ));

  const totalCount = countResult?.count ?? 0;

  if (totalCount === 0) {
    return {
      reviews: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Fetch reviews with reviewer info
  const rows = await db
    .select({
      reviewId: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      photos: review.photos,
      dsrItemAsDescribed: review.dsrItemAsDescribed,
      dsrShippingSpeed: review.dsrShippingSpeed,
      dsrCommunication: review.dsrCommunication,
      dsrPackaging: review.dsrPackaging,
      createdAt: review.createdAt,
      isVerifiedPurchase: review.isVerifiedPurchase,
      reviewerName: user.name,
      reviewerAvatarUrl: user.avatarUrl,
      responseId: reviewResponse.id,
      responseBody: reviewResponse.body,
      responseCreatedAt: reviewResponse.createdAt,
    })
    .from(review)
    .leftJoin(user, eq(review.reviewerUserId, user.id))
    .leftJoin(reviewResponse, eq(reviewResponse.reviewId, review.id))
    .where(and(
      eq(review.sellerId, sellerId),
      eq(review.status, 'APPROVED'),
      or(isNull(review.visibleAt), lte(review.visibleAt, sql`NOW()`))
    ))
    .orderBy(desc(review.createdAt))
    .limit(pageSize)
    .offset(offset);

  const reviews: ReviewData[] = rows.map((row) => ({
    id: row.reviewId,
    rating: row.rating,
    title: row.title,
    body: row.body,
    photos: row.photos ?? [],
    dsrItemAsDescribed: row.dsrItemAsDescribed,
    dsrShippingSpeed: row.dsrShippingSpeed,
    dsrCommunication: row.dsrCommunication,
    dsrPackaging: row.dsrPackaging,
    createdAt: row.createdAt,
    isVerifiedPurchase: row.isVerifiedPurchase,
    reviewerDisplayName: formatReviewerName(row.reviewerName ?? 'Anonymous'),
    reviewerAvatarUrl: row.reviewerAvatarUrl,
    response: row.responseId ? {
      id: row.responseId,
      body: row.responseBody!,
      createdAt: row.responseCreatedAt!,
    } : null,
  }));

  return {
    reviews,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Get average DSR ratings for a seller.
 *
 * Each dimension is averaged independently (buyer may rate some but not all).
 * Only includes APPROVED reviews with non-null DSR values.
 */
export async function getSellerDSRAverages(sellerId: string): Promise<SellerDSRAverages> {
  const [result] = await db
    .select({
      avgItemAsDescribed: sql<number | null>`avg(${review.dsrItemAsDescribed})::real`,
      avgShippingSpeed: sql<number | null>`avg(${review.dsrShippingSpeed})::real`,
      avgCommunication: sql<number | null>`avg(${review.dsrCommunication})::real`,
      avgPackaging: sql<number | null>`avg(${review.dsrPackaging})::real`,
    })
    .from(review)
    .where(and(
      eq(review.sellerId, sellerId),
      eq(review.status, 'APPROVED'),
      or(isNull(review.visibleAt), lte(review.visibleAt, sql`NOW()`))
    ));

  return {
    avgItemAsDescribed: result?.avgItemAsDescribed ?? null,
    avgShippingSpeed: result?.avgShippingSpeed ?? null,
    avgCommunication: result?.avgCommunication ?? null,
    avgPackaging: result?.avgPackaging ?? null,
  };
}

/**
 * Format reviewer name as "FirstName L." (first name + last initial).
 */
function formatReviewerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return 'Anonymous';
  if (parts.length === 1) return parts[0]!;

  const firstName = parts[0]!;
  const lastInitial = parts[parts.length - 1]![0]?.toUpperCase() ?? '';

  return `${firstName} ${lastInitial}.`;
}
