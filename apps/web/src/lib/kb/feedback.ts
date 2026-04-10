/**
 * KB Article Feedback Service
 *
 * Handles article helpfulness feedback submission and statistics.
 * Uses the existing kbArticleFeedback table from V3 schema.
 */

import { db } from '@twicely/db';
import { kbArticleFeedback } from '@twicely/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { ArticleFeedbackInput, FeedbackStats } from './types';

/**
 * Submits feedback for an article. One feedback per user per article
 * (based on userId — anonymous feedback is always accepted).
 */
export async function submitFeedback(
  articleId: string,
  input: ArticleFeedbackInput,
): Promise<{ id: string }> {
  const id = createId();

  await db.insert(kbArticleFeedback).values({
    id,
    articleId,
    userId: input.userId ?? null,
    helpful: input.helpful,
    comment: input.comment ?? null,
    createdAt: new Date(),
  });

  return { id };
}

/**
 * Returns all feedback entries for an article, ordered by creation date descending.
 */
export async function getFeedback(articleId: string): Promise<Array<{
  id: string;
  articleId: string;
  userId: string | null;
  helpful: boolean;
  comment: string | null;
  createdAt: Date;
}>> {
  return db
    .select()
    .from(kbArticleFeedback)
    .where(eq(kbArticleFeedback.articleId, articleId))
    .orderBy(sql`${kbArticleFeedback.createdAt} desc`);
}

/**
 * Returns aggregated feedback statistics for an article.
 */
export async function getFeedbackStats(articleId: string): Promise<FeedbackStats> {
  const [result] = await db
    .select({
      helpfulCount: sql<number>`count(*) filter (where ${kbArticleFeedback.helpful} = true)`,
      unhelpfulCount: sql<number>`count(*) filter (where ${kbArticleFeedback.helpful} = false)`,
    })
    .from(kbArticleFeedback)
    .where(eq(kbArticleFeedback.articleId, articleId));

  const helpfulCount = Number(result?.helpfulCount ?? 0);
  const unhelpfulCount = Number(result?.unhelpfulCount ?? 0);
  const total = helpfulCount + unhelpfulCount;
  const score = total > 0 ? helpfulCount / total : 0;

  return { helpfulCount, unhelpfulCount, score };
}
