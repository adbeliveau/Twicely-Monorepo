/**
 * Admin Moderation — Queue & Stats Queries (E3.5)
 * Split from admin-moderation.ts for file-size compliance.
 * Unified moderation queue and daily stats.
 */

import { db } from '@twicely/db';
import { listing, review, contentReport } from '@twicely/db/schema';
import { eq, count, gte, sql, or } from 'drizzle-orm';

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
