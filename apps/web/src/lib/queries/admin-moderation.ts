/**
 * Admin Moderation Queries (E3.5 + I5 + I6)
 * Flagged listings, reviews, queue, and review moderation for /mod
 */

import { db } from '@twicely/db';
import {
  listing, review, user, contentReport, enforcementAction,
  listingImage, sellerProfile, sellerPerformance, reviewResponse, category,
} from '@twicely/db/schema';
import { eq, count, inArray, and, ne, gte, sql, or } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModerationKPIs {
  flaggedListings: number;
  flaggedReviews: number;
  flaggedMessages: number;
  pendingReports: number;
  activeEnforcementActions: number;
}

export interface ModeratedListingRow {
  id: string;
  title: string | null;
  ownerUserId: string;
  sellerName: string;
  priceCents: number | null;
  enforcementState: string;
  createdAt: Date;
}

export interface SuppressedListingRow {
  id: string;
  title: string | null;
  ownerUserId: string;
  sellerName: string;
  priceCents: number | null;
  updatedAt: Date;
}

export interface PendingListingRow {
  id: string;
  title: string | null;
  ownerUserId: string;
  sellerName: string;
  priceCents: number | null;
  createdAt: Date;
}

export interface ModerationQueueItem {
  priority: number;
  type: 'Listing' | 'Report' | 'Review';
  targetId: string;
  targetTitle: string;
  source: string;
  dateFlagged: Date;
  status: string;
  detailUrl: string;
}

export interface ModeratedListingDetail {
  id: string;
  title: string | null;
  description: string | null;
  priceCents: number | null;
  condition: string | null;
  enforcementState: string;
  status: string;
  tags: string[];
  createdAt: Date;
  activatedAt: Date | null;
  categoryName: string | null;
  ownerUserId: string;
  sellerName: string;
  performanceBand: string;
  averageRating: number | null;
  totalReviews: number;
  activeEnforcementCount: number;
  images: Array<{ url: string; position: number }>;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function getModerationKPIs(): Promise<ModerationKPIs> {
  const [listingsResult, reviewsResult, reportsResult, enforcementResult] = await Promise.all([
    db.select({ count: count() }).from(listing).where(eq(listing.enforcementState, 'FLAGGED')),
    db.select({ count: count() }).from(review).where(eq(review.status, 'FLAGGED')),
    db.select({ count: count() }).from(contentReport).where(eq(contentReport.status, 'PENDING')),
    db.select({ count: count() }).from(enforcementAction).where(eq(enforcementAction.status, 'ACTIVE')),
  ]);

  return {
    flaggedListings: listingsResult[0]?.count ?? 0,
    flaggedReviews: reviewsResult[0]?.count ?? 0,
    flaggedMessages: 0,
    pendingReports: reportsResult[0]?.count ?? 0,
    activeEnforcementActions: enforcementResult[0]?.count ?? 0,
  };
}

// ─── Listings ─────────────────────────────────────────────────────────────────

/** Kept as alias for backwards compat */
export async function getFlaggedListings(page: number, pageSize: number) {
  return getModeratedListings('FLAGGED', page, pageSize);
}

export async function getModeratedListings(
  enforcementFilter: 'FLAGGED' | 'SUPPRESSED' | 'REMOVED' | null,
  page: number,
  pageSize: number
): Promise<{ listings: ModeratedListingRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const whereClause = enforcementFilter
    ? eq(listing.enforcementState, enforcementFilter)
    : ne(listing.enforcementState, 'CLEAR');

  const [totalResult] = await db.select({ count: count() }).from(listing).where(whereClause);

  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      ownerUserId: listing.ownerUserId,
      priceCents: listing.priceCents,
      enforcementState: listing.enforcementState,
      createdAt: listing.createdAt,
    })
    .from(listing)
    .where(whereClause)
    .orderBy(listing.createdAt)
    .limit(pageSize)
    .offset(offset);

  const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
  const owners = ownerIds.length > 0
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ownerIds))
    : [];
  const nameMap = new Map(owners.map((o) => [o.id, o.name]));

  return {
    listings: rows.map((r) => ({
      ...r,
      sellerName: nameMap.get(r.ownerUserId) ?? 'Unknown',
    })),
    total: totalResult?.count ?? 0,
  };
}

export async function getSuppressedListings(
  page: number,
  pageSize: number
): Promise<{ listings: SuppressedListingRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(listing)
    .where(eq(listing.enforcementState, 'SUPPRESSED'));

  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      ownerUserId: listing.ownerUserId,
      priceCents: listing.priceCents,
      updatedAt: listing.updatedAt,
    })
    .from(listing)
    .where(eq(listing.enforcementState, 'SUPPRESSED'))
    .orderBy(listing.updatedAt)
    .limit(pageSize)
    .offset(offset);

  const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];
  const owners = ownerIds.length > 0
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ownerIds))
    : [];
  const nameMap = new Map(owners.map((o) => [o.id, o.name]));

  return {
    listings: rows.map((r) => ({
      ...r,
      sellerName: nameMap.get(r.ownerUserId) ?? 'Unknown',
    })),
    total: totalResult?.count ?? 0,
  };
}

export async function getPendingFirstReviewListings(
  page: number,
  pageSize: number
): Promise<{ listings: PendingListingRow[]; total: number }> {
  const offset = (page - 1) * pageSize;

  // Flagged listings with no associated content report
  const rows = await db
    .select({
      id: listing.id,
      title: listing.title,
      ownerUserId: listing.ownerUserId,
      priceCents: listing.priceCents,
      createdAt: listing.createdAt,
    })
    .from(listing)
    .where(eq(listing.enforcementState, 'FLAGGED'));

  // Filter out those that have content reports
  const listingIds = rows.map((r) => r.id);
  const reportedIds = listingIds.length > 0
    ? await db
        .select({ targetId: contentReport.targetId })
        .from(contentReport)
        .where(
          and(
            eq(contentReport.targetType, 'LISTING'),
            inArray(contentReport.targetId, listingIds)
          )
        )
    : [];
  const reportedSet = new Set(reportedIds.map((r) => r.targetId));

  const pending = rows.filter((r) => !reportedSet.has(r.id));
  const paginated = pending.slice(offset, offset + pageSize);

  const ownerIds = [...new Set(paginated.map((r) => r.ownerUserId))];
  const owners = ownerIds.length > 0
    ? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ownerIds))
    : [];
  const nameMap = new Map(owners.map((o) => [o.id, o.name]));

  return {
    listings: paginated.map((r) => ({
      ...r,
      sellerName: nameMap.get(r.ownerUserId) ?? 'Unknown',
    })),
    total: pending.length,
  };
}

export async function getListingForModeration(listingId: string): Promise<ModeratedListingDetail | null> {
  const [row] = await db
    .select({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      condition: listing.condition,
      enforcementState: listing.enforcementState,
      status: listing.status,
      tags: listing.tags,
      createdAt: listing.createdAt,
      activatedAt: listing.activatedAt,
      ownerUserId: listing.ownerUserId,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!row) return null;

  const [ownerRow, images, catRow, spRow] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, row.ownerUserId)).limit(1),
    db.select({ url: listingImage.url, position: listingImage.position })
      .from(listingImage)
      .where(eq(listingImage.listingId, listingId))
      .orderBy(listingImage.position),
    row.categoryId
      ? db.select({ name: category.name }).from(category).where(eq(category.id, row.categoryId)).limit(1)
      : Promise.resolve([] as Array<{ name: string }>),
    db.select({
      performanceBand: sellerProfile.performanceBand,
      sellerProfileId: sellerProfile.id,
    })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, row.ownerUserId))
      .limit(1),
  ]);

  let averageRating: number | null = null;
  let totalReviews = 0;
  let activeEnforcementCount = 0;

  if (spRow[0]) {
    const [perfRow, enfCount] = await Promise.all([
      db.select({ averageRating: sellerPerformance.averageRating, totalReviews: sellerPerformance.totalReviews })
        .from(sellerPerformance)
        .where(eq(sellerPerformance.sellerProfileId, spRow[0].sellerProfileId))
        .limit(1),
      db.select({ count: count() })
        .from(enforcementAction)
        .where(and(eq(enforcementAction.userId, row.ownerUserId), eq(enforcementAction.status, 'ACTIVE'))),
    ]);
    averageRating = perfRow[0]?.averageRating ?? null;
    totalReviews = perfRow[0]?.totalReviews ?? 0;
    activeEnforcementCount = enfCount[0]?.count ?? 0;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    condition: row.condition,
    enforcementState: row.enforcementState,
    status: row.status,
    tags: row.tags,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    categoryName: catRow[0]?.name ?? null,
    ownerUserId: row.ownerUserId,
    sellerName: ownerRow[0]?.name ?? 'Unknown',
    performanceBand: spRow[0]?.performanceBand ?? 'EMERGING',
    averageRating,
    totalReviews,
    activeEnforcementCount,
    images,
  };
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export async function getModerationQueue(
  page: number,
  pageSize: number
): Promise<{ items: ModerationQueueItem[]; total: number }> {
  const [reports, flaggedListings, flaggedReviews] = await Promise.all([
    db.select({
      id: contentReport.id,
      targetId: contentReport.targetId,
      targetType: contentReport.targetType,
      reason: contentReport.reason,
      status: contentReport.status,
      createdAt: contentReport.createdAt,
    })
      .from(contentReport)
      .where(or(eq(contentReport.status, 'PENDING'), eq(contentReport.status, 'UNDER_REVIEW')))
      .orderBy(contentReport.createdAt),
    db.select({ id: listing.id, title: listing.title, createdAt: listing.createdAt })
      .from(listing)
      .where(eq(listing.enforcementState, 'FLAGGED'))
      .orderBy(listing.createdAt),
    db.select({ id: review.id, body: review.body, createdAt: review.createdAt })
      .from(review)
      .where(eq(review.status, 'FLAGGED'))
      .orderBy(review.createdAt),
  ]);

  const items: ModerationQueueItem[] = [];
  let priority = 1;

  for (const r of reports) {
    items.push({
      priority: priority++,
      type: 'Report',
      targetId: r.id,
      targetTitle: `${r.targetType} report: ${r.reason.replace(/_/g, ' ')}`,
      source: r.reason.replace(/_/g, ' '),
      dateFlagged: r.createdAt,
      status: r.status,
      detailUrl: `/mod/reports/${r.id}`,
    });
  }

  for (const l of flaggedListings) {
    items.push({
      priority: priority++,
      type: 'Listing',
      targetId: l.id,
      targetTitle: l.title ?? l.id,
      source: 'System/Staff flag',
      dateFlagged: l.createdAt,
      status: 'FLAGGED',
      detailUrl: `/mod/listings/${l.id}`,
    });
  }

  for (const rv of flaggedReviews) {
    items.push({
      priority: priority++,
      type: 'Review',
      targetId: rv.id,
      targetTitle: (rv.body ?? '').slice(0, 60) || rv.id,
      source: 'User flag',
      dateFlagged: rv.createdAt,
      status: 'FLAGGED',
      detailUrl: `/mod/reviews/${rv.id}`,
    });
  }

  const total = items.length;
  const paginated = items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return { items: paginated, total };
}

export async function getModerationStats(): Promise<{
  reportsToday: number;
  avgResolutionHours: number;
}> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [todayResult, avgResult] = await Promise.all([
    db.select({ count: count() })
      .from(contentReport)
      .where(gte(contentReport.createdAt, todayStart)),
    db.select({
      avg: sql<string>`AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600)`,
    })
      .from(contentReport)
      .where(gte(contentReport.reviewedAt, thirtyDaysAgo)),
  ]);

  return {
    reportsToday: todayResult[0]?.count ?? 0,
    avgResolutionHours: Math.round(Number(avgResult[0]?.avg ?? 0) * 10) / 10,
  };
}

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
