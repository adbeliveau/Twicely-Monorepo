'use server';

import { db } from '@twicely/db';
import { review, reviewResponse } from '@twicely/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';
import { sellerResponseSchema } from '@/lib/validations/seller-response';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

const submitResponseSchema = z.object({
  reviewId: z.string().cuid2(),
}).strict();

const updateResponseSchema = z.object({
  responseId: z.string().cuid2(),
}).strict();

interface ActionResult {
  success: boolean;
  error?: string;
  responseId?: string;
}

/**
 * Submit a seller response to a review.
 *
 * Business rules:
 * - Seller must own the review (review.sellerId === session.userId)
 * - One response per review (unique constraint on reviewResponse.reviewId)
 * - Must respond within 30 days of review creation
 * - Body: 1-2000 characters
 */
export async function submitSellerResponse(
  reviewId: string,
  body: string
): Promise<ActionResult> {
  // 1. Authorize and check permissions
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'You must be logged in to respond to reviews' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('ReviewResponse', { sellerId: userId }))) {
    return { success: false, error: 'You do not have permission to respond to reviews' };
  }

  // 2. Validate input
  const idParsed = submitResponseSchema.safeParse({ reviewId });
  if (!idParsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const validation = sellerResponseSchema.safeParse({ body });
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
  }

  // 3. Load review and verify ownership
  const [reviewData] = await db
    .select({
      id: review.id,
      sellerId: review.sellerId,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(eq(review.id, reviewId))
    .limit(1);

  if (!reviewData) {
    return { success: false, error: 'Review not found' };
  }

  if (reviewData.sellerId !== userId) {
    return { success: false, error: 'You can only respond to reviews on your own sales' };
  }

  // 4. Check no existing response (unique constraint will also catch this)
  const [existingResponse] = await db
    .select({ id: reviewResponse.id })
    .from(reviewResponse)
    .where(eq(reviewResponse.reviewId, reviewId))
    .limit(1);

  if (existingResponse) {
    return { success: false, error: 'A response already exists for this review' };
  }

  // 5. Check within response window (from platform settings)
  const responseWindowDays = await getPlatformSetting<number>('trust.review.sellerResponseWindowDays', 30);
  const now = new Date();
  const responseDeadline = new Date(reviewData.createdAt);
  responseDeadline.setDate(responseDeadline.getDate() + responseWindowDays);

  if (now > responseDeadline) {
    return { success: false, error: `Response window closed (${responseWindowDays} days after review)` };
  }

  // 6. Insert response
  const responseId = createId();
  await db.insert(reviewResponse).values({
    id: responseId,
    reviewId,
    sellerId: userId,
    body: validation.data.body,
  });

  // 7. Revalidate paths
  revalidatePath('/my/selling/orders/[id]', 'page');
  revalidatePath('/i/[slug]', 'page'); // Listing detail page shows reviews

  return { success: true, responseId };
}

/**
 * Update an existing seller response.
 *
 * Business rules:
 * - Seller must own the response (response.sellerId === session.userId)
 * - Can only edit within 24 hours of creation
 * - Body: 1-2000 characters
 */
export async function updateSellerResponse(
  responseId: string,
  body: string
): Promise<ActionResult> {
  // 1. Authorize and check permissions
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'You must be logged in to update responses' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('ReviewResponse', { sellerId: userId }))) {
    return { success: false, error: 'You do not have permission to update responses' };
  }

  // 2. Validate input
  const idParsed = updateResponseSchema.safeParse({ responseId });
  if (!idParsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const validation = sellerResponseSchema.safeParse({ body });
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message ?? 'Invalid input' };
  }

  // 3. Load response and verify ownership
  const [responseData] = await db
    .select({
      id: reviewResponse.id,
      sellerId: reviewResponse.sellerId,
      createdAt: reviewResponse.createdAt,
    })
    .from(reviewResponse)
    .where(eq(reviewResponse.id, responseId))
    .limit(1);

  if (!responseData) {
    return { success: false, error: 'Response not found' };
  }

  if (responseData.sellerId !== userId) {
    return { success: false, error: 'You can only update your own responses' };
  }

  // 4. Check edit window (from platform settings)
  const editWindowHours = await getPlatformSetting<number>('trust.review.editWindowHours', 24);
  const now = new Date();
  const editDeadline = new Date(responseData.createdAt);
  editDeadline.setHours(editDeadline.getHours() + editWindowHours);

  if (now > editDeadline) {
    return { success: false, error: `Edit window closed (${editWindowHours} hours after posting)` };
  }

  // 5. Update response
  await db
    .update(reviewResponse)
    .set({
      body: validation.data.body,
      updatedAt: now,
    })
    .where(eq(reviewResponse.id, responseId));

  // 6. Revalidate paths
  revalidatePath('/my/selling/orders/[id]', 'page');
  revalidatePath('/i/[slug]', 'page');

  return { success: true, responseId };
}

/**
 * Get reviews awaiting seller response.
 *
 * Returns reviews for this seller that have:
 * - No response yet
 * - Still within the 30-day response window
 *
 * Ordered by createdAt ASC (oldest first = urgency-first, nearest deadline).
 */
export async function getSellerPendingReviews(): Promise<
  Array<{
    reviewId: string;
    orderId: string;
    rating: number;
    title: string | null;
    body: string | null;
    createdAt: Date;
    daysRemaining: number;
  }>
> {
  const { session } = await authorize();
  if (!session) return [];

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  const now = new Date();
  const responseWindowDays = await getPlatformSetting<number>('trust.review.sellerResponseWindowDays', 30);

  const rows = await db
    .select({
      reviewId: review.id,
      orderId: review.orderId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
      responseId: reviewResponse.id,
    })
    .from(review)
    .leftJoin(reviewResponse, eq(reviewResponse.reviewId, review.id))
    .where(
      and(
        eq(review.sellerId, sellerId),
        eq(review.status, 'APPROVED'),
        isNull(reviewResponse.id) // No response yet
      )
    )
    .orderBy(review.createdAt); // ASC = urgency-first (oldest reviews have nearest deadline)

  // Filter to only those still within response window and calculate days remaining
  return rows
    .map((row) => {
      const deadline = new Date(row.createdAt);
      deadline.setDate(deadline.getDate() + responseWindowDays);
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        reviewId: row.reviewId,
        orderId: row.orderId,
        rating: row.rating,
        title: row.title,
        body: row.body,
        createdAt: row.createdAt,
        daysRemaining,
      };
    })
    .filter((item) => item.daysRemaining > 0);
}
