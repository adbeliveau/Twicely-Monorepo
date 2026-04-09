'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { listingQuestion, listing } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  answerQuestionSchema,
  hideQuestionSchema,
  pinQuestionSchema,
} from '@/lib/validations/qa';
import { notifyQuestionAnswered } from '@twicely/notifications/qa-notifier';
import type { AnswerQuestionInput, HideQuestionInput, PinQuestionInput } from '@/lib/validations/qa';
import { getQuestionById } from '@/lib/queries/qa';

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Answer a question on a listing (listing owner only).
 */
export async function answerQuestion(input: AnswerQuestionInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to answer questions' };
  }

  if (!ability.can('update', 'ListingQuestion')) {
    return { success: false, error: 'You do not have permission to answer questions' };
  }

  const parsed = answerQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { questionId, answerText } = parsed.data;

  // Fetch question + listing for ownership verification
  const questionRow = await getQuestionById(questionId);

  if (!questionRow) {
    return { success: false, error: 'Question not found' };
  }

  if (questionRow.isHidden) {
    return { success: false, error: 'Question not found' };
  }

  if (questionRow.answeredAt !== null) {
    return { success: false, error: 'This question has already been answered' };
  }

  // Action-level ownership check — must be listing owner or delegated staff for that seller
  const effectiveSellerId = session.onBehalfOfSellerId ?? session.userId;
  if (questionRow.listingOwnerUserId !== effectiveSellerId) {
    return { success: false, error: 'You do not have permission to answer this question' };
  }

  // Update with explicit field mapping
  await db
    .update(listingQuestion)
    .set({
      answerText,
      answeredAt: new Date(),
      answeredBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(listingQuestion.id, questionId));

  // Fire-and-forget notification
  notifyQuestionAnswered(questionId).catch(() => {});

  revalidatePath(`/i/${questionRow.listingSlug}`);

  return { success: true };
}

/**
 * Hide a question on a listing (listing owner only).
 */
export async function hideQuestion(input: HideQuestionInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in' };
  }

  if (!ability.can('delete', 'ListingQuestion')) {
    return { success: false, error: 'You do not have permission to hide questions' };
  }

  const parsed = hideQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { questionId } = parsed.data;

  const [questionRow] = await db
    .select({ listingId: listingQuestion.listingId })
    .from(listingQuestion)
    .where(eq(listingQuestion.id, questionId))
    .limit(1);

  if (!questionRow) {
    return { success: false, error: 'Question not found' };
  }

  const [listingRow] = await db
    .select({ ownerUserId: listing.ownerUserId, slug: listing.slug })
    .from(listing)
    .where(eq(listing.id, questionRow.listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  const effectiveSellerId = session.onBehalfOfSellerId ?? session.userId;
  if (listingRow.ownerUserId !== effectiveSellerId) {
    return { success: false, error: 'You do not have permission to hide this question' };
  }

  await db
    .update(listingQuestion)
    .set({ isHidden: true, updatedAt: new Date() })
    .where(eq(listingQuestion.id, questionId));

  revalidatePath(`/i/${listingRow.slug}`);

  return { success: true };
}

/**
 * Pin or unpin a question on a listing (listing owner only).
 * Maximum 3 pinned questions per listing.
 */
export async function pinQuestion(input: PinQuestionInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in' };
  }

  if (!ability.can('update', 'ListingQuestion')) {
    return { success: false, error: 'You do not have permission to pin questions' };
  }

  const parsed = pinQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { questionId, isPinned } = parsed.data;

  const [questionRow] = await db
    .select({ listingId: listingQuestion.listingId })
    .from(listingQuestion)
    .where(eq(listingQuestion.id, questionId))
    .limit(1);

  if (!questionRow) {
    return { success: false, error: 'Question not found' };
  }

  const [listingRow] = await db
    .select({ ownerUserId: listing.ownerUserId, slug: listing.slug })
    .from(listing)
    .where(eq(listing.id, questionRow.listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  const effectiveSellerId = session.onBehalfOfSellerId ?? session.userId;
  if (listingRow.ownerUserId !== effectiveSellerId) {
    return { success: false, error: 'You do not have permission to pin questions on this listing' };
  }

  // If pinning, enforce max 3 pinned per listing
  if (isPinned) {
    const [pinnedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(listingQuestion)
      .where(
        and(
          eq(listingQuestion.listingId, questionRow.listingId),
          eq(listingQuestion.isPinned, true),
          eq(listingQuestion.isHidden, false)
        )
      );

    if ((pinnedCount?.count ?? 0) >= 3) {
      return { success: false, error: 'You can pin at most 3 questions per listing' };
    }
  }

  await db
    .update(listingQuestion)
    .set({ isPinned, updatedAt: new Date() })
    .where(eq(listingQuestion.id, questionId));

  revalidatePath(`/i/${listingRow.slug}`);

  return { success: true };
}
