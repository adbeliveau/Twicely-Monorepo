import { db } from '@twicely/db';
import { review, reviewResponse, buyerReview } from '@twicely/db/schema';
import { eq, and, or, isNull, lte, sql } from 'drizzle-orm';

export interface OrderReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: Date;
}

export interface ReviewResponseData {
  id: string;
  body: string;
  createdAt: Date;
}

export interface BuyerReviewData {
  id: string;
  createdAt: Date;
}

export interface OrderReviewData {
  orderReview: OrderReview | null;
  existingResponse: ReviewResponseData | null;
  canRespondToReview: boolean;
  canEditResponse: boolean;
  existingBuyerReview: BuyerReviewData | null;
  canRateBuyer: boolean;
}

const EDIT_WINDOW_HOURS = 24;
const RESPONSE_WINDOW_DAYS = 30;
const BUYER_REVIEW_WINDOW_DAYS = 30;

export async function loadOrderReviewData(
  orderId: string,
  orderStatus: string,
  deliveredAt: Date | null,
): Promise<OrderReviewData> {
  let orderReview: OrderReview | null = null;
  let existingResponse: ReviewResponseData | null = null;
  let canRespondToReview = false;
  let canEditResponse = false;
  let existingBuyerReview: BuyerReviewData | null = null;
  let canRateBuyer = false;

  if (orderStatus === 'COMPLETED' || orderStatus === 'DELIVERED') {
    // Dual-blind: only show review if visibleAt has passed
    const [reviewData] = await db
      .select({
        id: review.id,
        rating: review.rating,
        title: review.title,
        body: review.body,
        createdAt: review.createdAt,
        visibleAt: review.visibleAt,
        responseId: reviewResponse.id,
        responseBody: reviewResponse.body,
        responseCreatedAt: reviewResponse.createdAt,
      })
      .from(review)
      .leftJoin(reviewResponse, eq(reviewResponse.reviewId, review.id))
      .where(and(
        eq(review.orderId, orderId),
        or(isNull(review.visibleAt), lte(review.visibleAt, sql`NOW()`))
      ))
      .limit(1);

    if (reviewData) {
      orderReview = {
        id: reviewData.id,
        rating: reviewData.rating,
        title: reviewData.title,
        body: reviewData.body,
        createdAt: reviewData.createdAt,
      };

      if (reviewData.responseId && reviewData.responseBody && reviewData.responseCreatedAt) {
        existingResponse = {
          id: reviewData.responseId,
          body: reviewData.responseBody,
          createdAt: reviewData.responseCreatedAt,
        };
      }
    }

    // Fetch existing buyer review (seller→buyer)
    const [br] = await db
      .select({ id: buyerReview.id, createdAt: buyerReview.createdAt })
      .from(buyerReview)
      .where(eq(buyerReview.orderId, orderId))
      .limit(1);

    if (br) {
      existingBuyerReview = br;
    } else if (deliveredAt) {
      const now = new Date();
      const windowEnd = new Date(deliveredAt);
      windowEnd.setDate(windowEnd.getDate() + BUYER_REVIEW_WINDOW_DAYS);
      canRateBuyer = now <= windowEnd;
    }
  }

  // Calculate if response is still editable (24-hour window per spec §Seller Response)
  if (existingResponse) {
    const now = new Date();
    const editDeadline = new Date(existingResponse.createdAt);
    editDeadline.setHours(editDeadline.getHours() + EDIT_WINDOW_HOURS);
    canEditResponse = now <= editDeadline;
  }

  if (orderReview && !existingResponse) {
    const now = new Date();
    const responseDeadline = new Date(orderReview.createdAt);
    responseDeadline.setDate(responseDeadline.getDate() + RESPONSE_WINDOW_DAYS);
    canRespondToReview = now <= responseDeadline;
  }

  return {
    orderReview,
    existingResponse,
    canRespondToReview,
    canEditResponse,
    existingBuyerReview,
    canRateBuyer,
  };
}

export { RESPONSE_WINDOW_DAYS };
