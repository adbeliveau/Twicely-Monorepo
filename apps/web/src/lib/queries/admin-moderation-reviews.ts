/**
 * Admin Moderation — Review & Message Queries (E3.5)
 * Split from admin-moderation.ts for file-size compliance.
 * Reviews moderation, review detail, message flag patterns.
 */

import { db } from '@twicely/db';
import {
  review, user, contentReport, reviewResponse,
} from '@twicely/db/schema';
import { eq, count, and, gte, sql } from 'drizzle-orm';

// ─── Reviews ──────────────────────────────────────────────────────────────────

/** Kept as alias for backwards compat */
export async function getFlaggedReviews(page: number, pageSize: number) {
  return getModeratedReviews(null, null, null, page, pageSize);
}

export async function getModeratedReviews(
  rating: number | null,
  status: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'REMOVED' | null,
  keyword: string | null,
  page: number,
  pageSize: number
): Promise<{ reviews: Array<{
  id: string;
  rating: number;
  comment: string | null;
  reviewerId: string;
  sellerId: string;
  status: string;
  createdAt: Date;
}>; total: number }> {
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) {
    conditions.push(eq(review.status, status));
  } else {
    conditions.push(eq(review.status, 'FLAGGED'));
  }
  if (rating !== null) {
    conditions.push(eq(review.rating, rating));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [totalResult] = await db.select({ count: count() }).from(review).where(whereClause);

  const rows = await db
    .select({
      id: review.id,
      rating: review.rating,
      comment: review.body,
      reviewerId: review.reviewerUserId,
      sellerId: review.sellerId,
      status: review.status,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(whereClause)
    .orderBy(review.createdAt)
    .limit(pageSize)
    .offset(offset);

  // Apply keyword filter in-memory (body is already fetched)
  const filtered = keyword
    ? rows.filter((r) => r.comment?.toLowerCase().includes(keyword.toLowerCase()))
    : rows;

  return { reviews: filtered, total: keyword ? filtered.length : (totalResult?.count ?? 0) };
}

export async function getReviewForModeration(reviewId: string) {
  const [row] = await db
    .select({
      id: review.id,
      orderId: review.orderId,
      reviewerUserId: review.reviewerUserId,
      sellerId: review.sellerId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      photos: review.photos,
      status: review.status,
      isVerifiedPurchase: review.isVerifiedPurchase,
      flagReason: review.flagReason,
      flaggedByUserId: review.flaggedByUserId,
      removedByStaffId: review.removedByStaffId,
      removedReason: review.removedReason,
      dsrItemAsDescribed: review.dsrItemAsDescribed,
      dsrShippingSpeed: review.dsrShippingSpeed,
      dsrCommunication: review.dsrCommunication,
      dsrPackaging: review.dsrPackaging,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(eq(review.id, reviewId))
    .limit(1);

  if (!row) return null;

  const [reviewerRow, sellerRow, responseRow] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, row.reviewerUserId)).limit(1),
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, row.sellerId)).limit(1),
    db.select({ body: reviewResponse.body, createdAt: reviewResponse.createdAt })
      .from(reviewResponse)
      .where(eq(reviewResponse.reviewId, reviewId))
      .limit(1),
  ]);

  return {
    ...row,
    reviewerName: reviewerRow[0]?.name ?? 'Unknown',
    sellerName: sellerRow[0]?.name ?? 'Unknown',
    sellerResponse: responseRow[0] ?? null,
  };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessageFlagPatterns(): Promise<Array<{ reason: string; count: number }>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ reason: contentReport.reason, count: count() })
    .from(contentReport)
    .where(
      and(
        eq(contentReport.targetType, 'MESSAGE'),
        gte(contentReport.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(contentReport.reason)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  return rows.map((r) => ({ reason: r.reason, count: r.count }));
}
