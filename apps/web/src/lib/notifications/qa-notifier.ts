import { db } from '@twicely/db';
import { listingQuestion, listing, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from './service';
import { logger } from '@twicely/logger';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

/**
 * Notify the listing owner (seller) when someone asks a question on their listing.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyQuestionAsked(questionId: string): Promise<void> {
  try {
    const [questionRow] = await db
      .select({
        id: listingQuestion.id,
        listingId: listingQuestion.listingId,
        askerId: listingQuestion.askerId,
        questionText: listingQuestion.questionText,
        isHidden: listingQuestion.isHidden,
      })
      .from(listingQuestion)
      .where(eq(listingQuestion.id, questionId))
      .limit(1);

    if (!questionRow || questionRow.isHidden) return;

    const [listingRow] = await db
      .select({
        ownerUserId: listing.ownerUserId,
        title: listing.title,
        slug: listing.slug,
      })
      .from(listing)
      .where(eq(listing.id, questionRow.listingId))
      .limit(1);

    if (!listingRow) return;

    // Do not notify if the seller asked their own question
    if (listingRow.ownerUserId === questionRow.askerId) return;

    const [askerRow] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, questionRow.askerId))
      .limit(1);

    const [sellerRow] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, listingRow.ownerUserId))
      .limit(1);

    notify(listingRow.ownerUserId, 'qa.new_question', {
      recipientName: sellerRow?.name ?? 'there',
      askerName: askerRow?.name ?? 'Someone',
      itemTitle: listingRow.title ?? 'Item',
      questionText: questionRow.questionText.slice(0, 200),
      listingUrl: `${BASE_URL}/i/${listingRow.slug}`,
    }).catch(() => {});
  } catch (err) {
    logger.error('[notifyQuestionAsked] Error', { error: String(err) });
  }
}

/**
 * Notify the question asker when the seller answers their question.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyQuestionAnswered(questionId: string): Promise<void> {
  try {
    const [questionRow] = await db
      .select({
        id: listingQuestion.id,
        listingId: listingQuestion.listingId,
        askerId: listingQuestion.askerId,
        answerText: listingQuestion.answerText,
        answeredBy: listingQuestion.answeredBy,
        isHidden: listingQuestion.isHidden,
      })
      .from(listingQuestion)
      .where(eq(listingQuestion.id, questionId))
      .limit(1);

    if (!questionRow || questionRow.isHidden || !questionRow.answerText) return;

    // Do not notify if the asker somehow answered their own question
    if (questionRow.answeredBy === questionRow.askerId) return;

    const [listingRow] = await db
      .select({
        title: listing.title,
        slug: listing.slug,
      })
      .from(listing)
      .where(eq(listing.id, questionRow.listingId))
      .limit(1);

    if (!listingRow) return;

    const [askerRow] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, questionRow.askerId))
      .limit(1);

    notify(questionRow.askerId, 'qa.answer_received', {
      recipientName: askerRow?.name ?? 'there',
      itemTitle: listingRow.title ?? 'Item',
      answerText: questionRow.answerText.slice(0, 200),
      listingUrl: `${BASE_URL}/i/${listingRow.slug}`,
    }).catch(() => {});
  } catch (err) {
    logger.error('[notifyQuestionAnswered] Error', { error: String(err) });
  }
}
