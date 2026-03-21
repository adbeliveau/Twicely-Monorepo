'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { review, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { reviewSubmissionSchema, type ReviewSubmissionData } from '@/lib/validations/review';
import { updateSellerPerformanceAggregates } from '@twicely/commerce/seller-performance';
import { updateReviewVisibility } from '@twicely/commerce/review-visibility';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

interface ReviewActionResult {
  success: boolean;
  reviewId?: string;
  errors?: Record<string, string>;
  error?: string;
}

function parseReviewData(data: unknown): { data: ReviewSubmissionData } | { errors: Record<string, string> } {
  const parsed = reviewSubmissionSchema.safeParse(data);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field && typeof field === 'string') errors[field] = issue.message;
    }
    return { errors };
  }
  return { data: parsed.data };
}

/**
 * Submit a review for an order.
 *
 * Business rules:
 * - Buyer must own the order
 * - Order must be COMPLETED or DELIVERED
 * - Review window: configurable via review.windowDays (default 60 days)
 * - One review per order (orderId unique constraint)
 */
export async function submitReview(orderId: string, data: ReviewSubmissionData): Promise<ReviewActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to leave a review' };
  }

  if (!ability.can('create', 'Review')) {
    return { success: false, error: 'Your account cannot create reviews' };
  }

  const userId = session.userId;

  // Validate input
  const result = parseReviewData(data);
  if ('errors' in result) return { success: false, errors: result.errors };
  const v = result.data;

  // Fetch order with buyer/seller info
  const [orderRecord] = await db
    .select({
      id: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
      completedAt: order.completedAt,
      deliveredAt: order.deliveredAt,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!orderRecord) {
    return { success: false, error: 'Order not found' };
  }

  // Check ownership
  if (orderRecord.buyerId !== userId) {
    return { success: false, error: 'You can only review orders you purchased' };
  }

  // Check order status
  if (orderRecord.status !== 'COMPLETED' && orderRecord.status !== 'DELIVERED') {
    return { success: false, error: 'You can only review completed or delivered orders' };
  }

  // Check review window (from platform settings)
  const referenceDate = orderRecord.deliveredAt || orderRecord.completedAt;
  if (!referenceDate) {
    return { success: false, error: 'Order completion date not available' };
  }

  const reviewWindowDays = await getPlatformSetting<number>('review.windowDays', 60);
  const now = new Date();
  const windowEndDate = new Date(referenceDate);
  windowEndDate.setDate(windowEndDate.getDate() + reviewWindowDays);

  if (now > windowEndDate) {
    return { success: false, error: `Review window closed. You had ${reviewWindowDays} days after order completion to leave a review.` };
  }

  // Check for existing review (orderId unique constraint will fail if duplicate)
  const [existingReview] = await db
    .select({ id: review.id })
    .from(review)
    .where(eq(review.orderId, orderId))
    .limit(1);

  if (existingReview) {
    return { success: false, error: 'You have already reviewed this order' };
  }

  // Create review
  const [newReview] = await db.insert(review).values({
    orderId,
    reviewerUserId: userId,
    sellerId: orderRecord.sellerId,
    rating: v.rating,
    title: v.title?.trim() || null,
    body: v.body?.trim() || null,
    photos: v.photos || [],
    dsrItemAsDescribed: v.dsrItemAsDescribed ?? null,
    dsrShippingSpeed: v.dsrShippingSpeed ?? null,
    dsrCommunication: v.dsrCommunication ?? null,
    dsrPackaging: v.dsrPackaging ?? null,
    status: 'APPROVED', // Auto-approval per specs
    isVerifiedPurchase: true,
    orderValueCents: orderRecord.totalCents,
  }).returning({ id: review.id });

  // Update seller performance aggregates
  await updateSellerPerformanceAggregates(orderRecord.sellerId);

  // Update dual-blind visibility (C1.5)
  await updateReviewVisibility(orderId);

  revalidatePath(`/my/buying/orders/${orderId}`);
  // Note: /seller/[id] routes don't exist yet (Phase D storefronts)
  return { success: true, reviewId: newReview!.id };
}

/**
 * Update an existing review.
 *
 * Business rules:
 * - Buyer must own the review
 * - Edit window: configurable via review.editWindowHours (default 48 hours)
 */
export async function updateReview(reviewId: string, data: ReviewSubmissionData): Promise<ReviewActionResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'Review')) {
    return { success: false, error: 'Your account cannot update reviews' };
  }

  const userId = session.userId;

  // Validate input
  const result = parseReviewData(data);
  if ('errors' in result) return { success: false, errors: result.errors };
  const v = result.data;

  // Fetch review with ownership check
  const [existingReview] = await db
    .select({
      id: review.id,
      reviewerUserId: review.reviewerUserId,
      orderId: review.orderId,
      sellerId: review.sellerId,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(eq(review.id, reviewId))
    .limit(1);

  if (!existingReview) {
    return { success: false, error: 'Review not found' };
  }

  // Check ownership
  if (existingReview.reviewerUserId !== userId) {
    return { success: false, error: 'You can only edit your own reviews' };
  }

  // Check edit window (from platform settings)
  const editWindowHours = await getPlatformSetting<number>('review.editWindowHours', 48);
  const now = new Date();
  const editWindowEnd = new Date(existingReview.createdAt);
  editWindowEnd.setHours(editWindowEnd.getHours() + editWindowHours);

  if (now > editWindowEnd) {
    return { success: false, error: `Edit window closed. You had ${editWindowHours} hours after posting to edit your review.` };
  }

  // Update review
  await db.update(review).set({
    rating: v.rating,
    title: v.title?.trim() || null,
    body: v.body?.trim() || null,
    photos: v.photos || [],
    dsrItemAsDescribed: v.dsrItemAsDescribed ?? null,
    dsrShippingSpeed: v.dsrShippingSpeed ?? null,
    dsrCommunication: v.dsrCommunication ?? null,
    dsrPackaging: v.dsrPackaging ?? null,
    updatedAt: new Date(),
  }).where(eq(review.id, reviewId));

  // Recalculate seller performance aggregates
  await updateSellerPerformanceAggregates(existingReview.sellerId);

  // Update dual-blind visibility (C1.5)
  await updateReviewVisibility(existingReview.orderId);

  revalidatePath(`/my/buying/orders/${existingReview.orderId}`);
  // Note: /seller/[id] routes don't exist yet (Phase D storefronts)
  return { success: true, reviewId };
}

// Re-export query function from its dedicated module
export { getReviewForOrder } from '@/lib/queries/review-for-order';
