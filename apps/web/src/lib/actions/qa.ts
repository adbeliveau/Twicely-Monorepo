'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { listingQuestion, listing } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { askQuestionSchema } from '@/lib/validations/qa';
import { notifyQuestionAsked } from '@twicely/notifications/qa-notifier';
import type { AskQuestionInput } from '@/lib/validations/qa';
import {
  answerQuestion as _answerQuestion,
  hideQuestion as _hideQuestion,
  pinQuestion as _pinQuestion,
} from './qa-seller';
import type { AnswerQuestionInput, HideQuestionInput, PinQuestionInput } from '@/lib/validations/qa';

// Async wrappers — "use server" files can only export async functions, not re-exports.
export async function answerQuestion(input: AnswerQuestionInput) {
  return _answerQuestion(input);
}
export async function hideQuestion(input: HideQuestionInput) {
  return _hideQuestion(input);
}
export async function pinQuestion(input: PinQuestionInput) {
  return _pinQuestion(input);
}

interface ActionResult {
  success: boolean;
  error?: string;
  questionId?: string;
}

/**
 * Ask a question on a listing (any authenticated user can ask).
 */
export async function askQuestion(input: AskQuestionInput): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to ask a question' };
  }

  if (!ability.can('create', 'ListingQuestion')) {
    return { success: false, error: 'You do not have permission to ask questions' };
  }

  const parsed = askQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { listingId, questionText } = parsed.data;

  // Verify listing exists and is ACTIVE
  const [listingRow] = await db
    .select({ id: listing.id, status: listing.status, slug: listing.slug })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  if (listingRow.status !== 'ACTIVE') {
    return { success: false, error: 'This listing is not available' };
  }

  // Anti-spam: max 3 pending (unanswered) questions per user per listing
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingQuestion)
    .where(
      and(
        eq(listingQuestion.listingId, listingId),
        eq(listingQuestion.askerId, session.userId),
        eq(listingQuestion.isHidden, false),
        sql`${listingQuestion.answeredAt} IS NULL`
      )
    );

  if ((pendingCount?.count ?? 0) >= 3) {
    return { success: false, error: 'You already have 3 unanswered questions on this listing' };
  }

  // Insert with explicit field mapping
  const [newQuestion] = await db
    .insert(listingQuestion)
    .values({
      listingId,
      askerId: session.userId,
      questionText,
    })
    .returning({ id: listingQuestion.id });

  if (!newQuestion) {
    return { success: false, error: 'Failed to submit question' };
  }

  // Fire-and-forget notification
  notifyQuestionAsked(newQuestion.id).catch(() => {});

  revalidatePath(`/i/${listingRow.slug}`);

  return { success: true, questionId: newQuestion.id };
}
