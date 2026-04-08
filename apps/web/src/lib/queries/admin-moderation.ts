/**
 * Admin Moderation Queries (E3.5 + I5 + I6)
 * Flagged listings, reviews, queue, and review moderation for /mod
 */

import { db } from '@twicely/db';
import {
  listing, review, user, contentReport, enforcementAction,
} from '@twicely/db/schema';
import { eq, count, inArray, and, ne } from 'drizzle-orm';

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


// ─── Re-exports from split modules ────────────────────────────────────────
// Queue/stats moved to admin-moderation-queue.ts (R1 from split).
// Review moderation moved to admin-moderation-reviews.ts (R2 from split).
// Callers still import from this file thanks to these re-exports.
export {
  getModerationQueue,
  getModerationStats,
  type ModerationQueueItem,
} from './admin-moderation-queue';
export {
  getFlaggedReviews,
  getModeratedReviews,
  getReviewForModeration,
  getMessageFlagPatterns,
} from './admin-moderation-reviews';
export {
  getListingForModeration,
  type ModeratedListingDetail,
} from './admin-moderation-detail';
