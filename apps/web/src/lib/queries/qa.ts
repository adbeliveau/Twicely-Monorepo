import { db } from '@twicely/db';
import { listingQuestion, listing, user } from '@twicely/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ─── Return Types ────────────────────────────────────────────────────────────

export interface QuestionSummary {
  id: string;
  askerId: string;
  askerName: string;
  questionText: string;
  answerText: string | null;
  answeredAt: Date | null;
  answeredBy: string | null;
  isPinned: boolean;
  createdAt: Date;
}

export interface QuestionDetail {
  id: string;
  listingId: string;
  askerId: string;
  questionText: string;
  answerText: string | null;
  answeredAt: Date | null;
  answeredBy: string | null;
  isPinned: boolean;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
  listingOwnerUserId: string;
  listingTitle: string | null;
  listingSlug: string | null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get all non-hidden questions for a listing.
 * Pinned questions appear first, then newest first.
 * No auth required — Q&A is public.
 */
export async function getQuestionsForListing(
  listingId: string
): Promise<QuestionSummary[]> {
  const rows = await db
    .select({
      id: listingQuestion.id,
      askerId: listingQuestion.askerId,
      askerName: user.name,
      questionText: listingQuestion.questionText,
      answerText: listingQuestion.answerText,
      answeredAt: listingQuestion.answeredAt,
      answeredBy: listingQuestion.answeredBy,
      isPinned: listingQuestion.isPinned,
      createdAt: listingQuestion.createdAt,
    })
    .from(listingQuestion)
    .innerJoin(user, eq(user.id, listingQuestion.askerId))
    .where(
      and(
        eq(listingQuestion.listingId, listingId),
        eq(listingQuestion.isHidden, false)
      )
    )
    .orderBy(
      desc(listingQuestion.isPinned),
      desc(listingQuestion.createdAt)
    );

  return rows.map((row) => ({
    id: row.id,
    askerId: row.askerId,
    askerName: row.askerName,
    questionText: row.questionText,
    answerText: row.answerText,
    answeredAt: row.answeredAt,
    answeredBy: row.answeredBy,
    isPinned: row.isPinned,
    createdAt: row.createdAt,
  }));
}

/**
 * Get a single question with its associated listing info.
 * Used internally by actions for ownership verification.
 */
export async function getQuestionById(
  questionId: string
): Promise<QuestionDetail | null> {
  const [row] = await db
    .select({
      id: listingQuestion.id,
      listingId: listingQuestion.listingId,
      askerId: listingQuestion.askerId,
      questionText: listingQuestion.questionText,
      answerText: listingQuestion.answerText,
      answeredAt: listingQuestion.answeredAt,
      answeredBy: listingQuestion.answeredBy,
      isPinned: listingQuestion.isPinned,
      isHidden: listingQuestion.isHidden,
      createdAt: listingQuestion.createdAt,
      updatedAt: listingQuestion.updatedAt,
      listingOwnerUserId: listing.ownerUserId,
      listingTitle: listing.title,
      listingSlug: listing.slug,
    })
    .from(listingQuestion)
    .innerJoin(listing, eq(listing.id, listingQuestion.listingId))
    .where(eq(listingQuestion.id, questionId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    listingId: row.listingId,
    askerId: row.askerId,
    questionText: row.questionText,
    answerText: row.answerText,
    answeredAt: row.answeredAt,
    answeredBy: row.answeredBy,
    isPinned: row.isPinned,
    isHidden: row.isHidden,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    listingOwnerUserId: row.listingOwnerUserId,
    listingTitle: row.listingTitle,
    listingSlug: row.listingSlug,
  };
}
