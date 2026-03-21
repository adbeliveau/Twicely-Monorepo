import { db } from '@twicely/db';
import { review, user, reviewResponse, order, orderItem, listing } from '@twicely/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

/**
 * Get all reviews written by a buyer (paginated).
 *
 * Returns reviews authored by the user, ordered by most recent first.
 * Includes: review data, DSR scores, seller name, listing details, seller response (if exists),
 * and canEdit flag (48-hour edit window).
 */
export async function getBuyerReviews(
  userId: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<{
  reviews: Array<{
    id: string;
    orderId: string;
    rating: number;
    title: string | null;
    body: string | null;
    dsrItemAsDescribed: number | null;
    dsrShippingSpeed: number | null;
    dsrCommunication: number | null;
    dsrPackaging: number | null;
    createdAt: Date;
    status: string;
    visibleAt: Date | null;
    isVisible: boolean;
    canEdit: boolean;
    hoursUntilEditExpires: number | null;
    sellerName: string;
    listingTitle: string | null;
    listingSlug: string | null;
    response: { body: string; createdAt: Date } | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(review)
    .where(eq(review.reviewerUserId, userId));

  const totalCount = countResult?.count ?? 0;

  if (totalCount === 0) {
    return {
      reviews: [],
      pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
    };
  }

  // Get paginated reviews with joins for seller name and listing details
  const rows = await db
    .select({
      // Review fields
      id: review.id,
      orderId: review.orderId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      dsrItemAsDescribed: review.dsrItemAsDescribed,
      dsrShippingSpeed: review.dsrShippingSpeed,
      dsrCommunication: review.dsrCommunication,
      dsrPackaging: review.dsrPackaging,
      createdAt: review.createdAt,
      status: review.status,
      visibleAt: review.visibleAt,
      sellerId: review.sellerId,
      // Seller name (from user table via sellerId)
      sellerName: user.name,
      // Listing details (from order → orderItem → listing)
      listingTitle: listing.title,
      listingSlug: listing.slug,
      // Seller response (if exists)
      responseId: reviewResponse.id,
      responseBody: reviewResponse.body,
      responseCreatedAt: reviewResponse.createdAt,
    })
    .from(review)
    .innerJoin(user, eq(user.id, review.sellerId))
    .innerJoin(order, eq(order.id, review.orderId))
    // NOTE: Assumes 1 orderItem per order (current checkout flow).
    // When bundles land (multi-item orders), replace with subquery
    // to grab first item + count. See issues list #23.
    .innerJoin(orderItem, eq(orderItem.orderId, order.id))
    .innerJoin(listing, eq(listing.id, orderItem.listingId))
    .leftJoin(reviewResponse, eq(reviewResponse.reviewId, review.id))
    .where(eq(review.reviewerUserId, userId))
    .orderBy(desc(review.createdAt))
    .limit(pageSize)
    .offset(offset);

  const now = new Date();
  const editWindowHours = await getPlatformSetting<number>('review.editWindowHours', 48);

  const reviews = rows.map((row) => {
    // Calculate edit eligibility
    const editDeadline = new Date(row.createdAt);
    editDeadline.setHours(editDeadline.getHours() + editWindowHours);
    const canEdit = now <= editDeadline && row.status === 'APPROVED';
    const hoursUntilEditExpires = canEdit
      ? Math.ceil((editDeadline.getTime() - now.getTime()) / (1000 * 60 * 60))
      : null;

    return {
      id: row.id,
      orderId: row.orderId,
      rating: row.rating,
      title: row.title,
      body: row.body,
      dsrItemAsDescribed: row.dsrItemAsDescribed,
      dsrShippingSpeed: row.dsrShippingSpeed,
      dsrCommunication: row.dsrCommunication,
      dsrPackaging: row.dsrPackaging,
      createdAt: row.createdAt,
      status: row.status,
      visibleAt: row.visibleAt,
      isVisible: !row.visibleAt || row.visibleAt <= now,
      canEdit,
      hoursUntilEditExpires,
      sellerName: row.sellerName,
      listingTitle: row.listingTitle,
      listingSlug: row.listingSlug,
      response:
        row.responseId && row.responseBody && row.responseCreatedAt
          ? { body: row.responseBody, createdAt: row.responseCreatedAt }
          : null,
    };
  });

  return {
    reviews,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}
