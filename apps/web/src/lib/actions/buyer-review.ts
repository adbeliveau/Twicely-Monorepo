'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { order, buyerReview } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { createId } from '@paralleldrive/cuid2';
import { updateReviewVisibility } from '@twicely/commerce/review-visibility';
import {
  submitBuyerReviewSchema,
  updateBuyerReviewSchema,
  type SubmitBuyerReviewInput,
  type UpdateBuyerReviewInput,
} from '@/lib/validations/buyer-review';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

type Result = { success: boolean; error?: string; reviewId?: string };

function calcOverall(payment: number, comm: number, ret: number | null): number {
  return ret !== null ? Math.round((payment + comm + ret) / 3) : Math.round((payment + comm) / 2);
}

/** Submit seller→buyer review (seller rates buyer). */
export async function submitBuyerReview(data: SubmitBuyerReviewInput): Promise<Result> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('create', 'Review')) return { success: false, error: 'Not authorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  const v = submitBuyerReviewSchema.safeParse(data);
  if (!v.success) return { success: false, error: 'Invalid input' };

  const { orderId, ratingPayment, ratingCommunication, ratingReturnBehavior, note } = v.data;

  const [o] = await db
    .select({ sellerId: order.sellerId, buyerId: order.buyerId, status: order.status, deliveredAt: order.deliveredAt })
    .from(order).where(eq(order.id, orderId)).limit(1);

  if (!o) return { success: false, error: 'Order not found' };
  if (o.sellerId !== userId) return { success: false, error: 'Only the seller can rate the buyer' };
  if (o.status !== 'DELIVERED' && o.status !== 'COMPLETED') return { success: false, error: 'Order must be delivered' };
  if (!o.deliveredAt) return { success: false, error: 'Delivery date not available' };

  const submitWindowDays = await getPlatformSetting<number>('trust.review.windowDays', 60);
  const windowEnd = new Date(o.deliveredAt);
  windowEnd.setDate(windowEnd.getDate() + submitWindowDays);
  if (new Date() > windowEnd) return { success: false, error: `Review window closed (${submitWindowDays} days)` };

  const [existing] = await db.select({ id: buyerReview.id }).from(buyerReview).where(eq(buyerReview.orderId, orderId)).limit(1);
  if (existing) return { success: false, error: 'Buyer already reviewed for this order' };

  const reviewId = createId();
  await db.insert(buyerReview).values({
    id: reviewId,
    orderId,
    sellerUserId: userId,
    buyerUserId: o.buyerId,
    ratingPayment,
    ratingCommunication,
    ratingReturnBehavior,
    overallRating: calcOverall(ratingPayment, ratingCommunication, ratingReturnBehavior),
    note,
  });

  await updateReviewVisibility(orderId);
  revalidatePath(`/my/selling/orders/${orderId}`);
  return { success: true, reviewId };
}

/** Update seller→buyer review (within edit window). */
export async function updateBuyerReview(data: UpdateBuyerReviewInput): Promise<Result> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not authenticated' };
  if (!ability.can('update', 'Review')) return { success: false, error: 'Not authorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  const v = updateBuyerReviewSchema.safeParse(data);
  if (!v.success) return { success: false, error: 'Invalid input' };

  const { reviewId, ratingPayment, ratingCommunication, ratingReturnBehavior, note } = v.data;

  const [r] = await db
    .select({ id: buyerReview.id, orderId: buyerReview.orderId, sellerUserId: buyerReview.sellerUserId, createdAt: buyerReview.createdAt })
    .from(buyerReview).where(eq(buyerReview.id, reviewId)).limit(1);

  if (!r) return { success: false, error: 'Review not found' };
  if (r.sellerUserId !== userId) return { success: false, error: 'Unauthorized' };

  const editWindowHours = await getPlatformSetting<number>('trust.review.editWindowHours', 48);
  const editDeadline = new Date(r.createdAt);
  editDeadline.setHours(editDeadline.getHours() + editWindowHours);
  if (new Date() > editDeadline) return { success: false, error: `Edit window closed (${editWindowHours}h)` };

  await db.update(buyerReview).set({
    ratingPayment,
    ratingCommunication,
    ratingReturnBehavior,
    overallRating: calcOverall(ratingPayment, ratingCommunication, ratingReturnBehavior),
    note,
    updatedAt: new Date(),
  }).where(eq(buyerReview.id, reviewId));

  await updateReviewVisibility(r.orderId);
  revalidatePath(`/my/selling/orders/${r.orderId}`);
  return { success: true, reviewId };
}
