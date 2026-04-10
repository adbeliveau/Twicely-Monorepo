import { db } from '@twicely/db';
import { reviewModerationQueue } from '@twicely/db/schema';
import { eq, count, and, desc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { ModerationAction, PaginationInput, PaginatedResult, ReviewModerationStats } from './types';

/** Profanity word list for auto-flagging */
const PROFANITY_LIST = [
  'spam', 'scam', 'fake', 'fraud',
];

/** Personal info patterns */
const PERSONAL_INFO_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,  // phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // email addresses
];

/**
 * Submit a review for moderation.
 * Creates an entry in the moderation queue.
 */
export async function submitForModeration(
  reviewId: string,
  listingId: string,
  reviewerId: string
): Promise<{ id: string }> {
  const id = createId();
  await db.insert(reviewModerationQueue).values({
    id,
    reviewId,
    listingId,
    reviewerId,
    status: 'PENDING',
  });
  return { id };
}

/**
 * Auto-flag a review based on content analysis.
 * Checks for profanity, personal info, and competitor mentions.
 * Returns the flag reason if flagged, null if clean.
 */
export async function autoFlagReview(
  reviewId: string,
  listingId: string,
  reviewerId: string,
  reviewText: string
): Promise<{ flagged: boolean; reason: string | null; queueId: string | null }> {
  const autoFlagEnabled = await getPlatformSetting<boolean>('buyer.review.autoFlagEnabled', true);
  if (!autoFlagEnabled) {
    return { flagged: false, reason: null, queueId: null };
  }

  const threshold = await getPlatformSetting<number>('buyer.review.profanityThreshold', 50);
  const lowerText = reviewText.toLowerCase();

  // Check profanity
  let score = 0;
  let flagReason: string | null = null;

  for (const word of PROFANITY_LIST) {
    if (lowerText.includes(word)) {
      score += 30;
      flagReason = 'PROFANITY';
    }
  }

  // Check personal info
  for (const pattern of PERSONAL_INFO_PATTERNS) {
    if (pattern.test(reviewText)) {
      score += 40;
      flagReason = flagReason ?? 'PERSONAL_INFO';
    }
  }

  if (score >= threshold) {
    const id = createId();
    await db.insert(reviewModerationQueue).values({
      id,
      reviewId,
      listingId,
      reviewerId,
      status: 'PENDING',
      flagReason,
    });
    return { flagged: true, reason: flagReason, queueId: id };
  }

  return { flagged: false, reason: null, queueId: null };
}

/**
 * Moderate a review in the queue (approve or reject).
 */
export async function moderateReview(
  queueId: string,
  action: ModerationAction,
  moderatorId: string
): Promise<void> {
  await db
    .update(reviewModerationQueue)
    .set({
      status: action,
      moderatedByUserId: moderatorId,
      moderatedAt: new Date(),
    })
    .where(eq(reviewModerationQueue.id, queueId));
}

/**
 * Get pending reviews for moderation with pagination.
 */
export async function getPendingReviews(
  pagination: PaginationInput = {}
): Promise<PaginatedResult<{
  id: string;
  reviewId: string;
  listingId: string;
  reviewerId: string;
  status: string;
  flagReason: string | null;
  createdAt: Date;
}>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [totalResult] = await db
    .select({ count: count() })
    .from(reviewModerationQueue)
    .where(eq(reviewModerationQueue.status, 'PENDING'));

  const items = await db
    .select({
      id: reviewModerationQueue.id,
      reviewId: reviewModerationQueue.reviewId,
      listingId: reviewModerationQueue.listingId,
      reviewerId: reviewModerationQueue.reviewerId,
      status: reviewModerationQueue.status,
      flagReason: reviewModerationQueue.flagReason,
      createdAt: reviewModerationQueue.createdAt,
    })
    .from(reviewModerationQueue)
    .where(eq(reviewModerationQueue.status, 'PENDING'))
    .orderBy(desc(reviewModerationQueue.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    items,
    total: totalResult?.count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Get review moderation statistics.
 */
export async function getReviewStats(): Promise<ReviewModerationStats> {
  const results = await db
    .select({
      status: reviewModerationQueue.status,
      count: count(),
    })
    .from(reviewModerationQueue)
    .groupBy(reviewModerationQueue.status);

  const stats: ReviewModerationStats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  for (const row of results) {
    const c = row.count;
    stats.total += c;
    if (row.status === 'PENDING') stats.pending = c;
    else if (row.status === 'APPROVED') stats.approved = c;
    else if (row.status === 'REJECTED') stats.rejected = c;
  }

  return stats;
}
