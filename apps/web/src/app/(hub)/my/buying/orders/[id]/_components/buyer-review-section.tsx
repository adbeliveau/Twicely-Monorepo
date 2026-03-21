import Link from 'next/link';
import { db } from '@twicely/db';
import { review, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@twicely/ui/button';
import { Star } from 'lucide-react';

const EDIT_WINDOW_HOURS = 48;
const REVIEW_WINDOW_DAYS = 30;

type ReviewState = 'CAN_REVIEW' | 'CAN_EDIT' | 'ALREADY_REVIEWED' | 'WINDOW_CLOSED' | 'NOT_ELIGIBLE';

interface BuyerReviewSectionProps {
  orderId: string;
  orderStatus: string;
  deliveredAt: Date | null;
}

export async function BuyerReviewSection({ orderId, orderStatus, deliveredAt }: BuyerReviewSectionProps) {
  // Fetch completedAt separately
  const [orderTimestamps] = await db
    .select({ completedAt: order.completedAt })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  // Check if review exists and if user can still edit
  const [existingReview] = await db
    .select({ id: review.id, createdAt: review.createdAt })
    .from(review)
    .where(eq(review.orderId, orderId))
    .limit(1);

  const now = new Date();
  let reviewState: ReviewState;

  if (orderStatus !== 'COMPLETED' && orderStatus !== 'DELIVERED') {
    reviewState = 'NOT_ELIGIBLE';
  } else if (existingReview) {
    const editWindowEnd = new Date(existingReview.createdAt);
    editWindowEnd.setHours(editWindowEnd.getHours() + EDIT_WINDOW_HOURS);
    reviewState = now <= editWindowEnd ? 'CAN_EDIT' : 'ALREADY_REVIEWED';
  } else {
    const referenceDate = deliveredAt || orderTimestamps?.completedAt;
    if (!referenceDate) {
      reviewState = 'NOT_ELIGIBLE';
    } else {
      const windowEndDate = new Date(referenceDate);
      windowEndDate.setDate(windowEndDate.getDate() + REVIEW_WINDOW_DAYS);
      reviewState = now <= windowEndDate ? 'CAN_REVIEW' : 'WINDOW_CLOSED';
    }
  }

  if (reviewState === 'NOT_ELIGIBLE' || reviewState === 'WINDOW_CLOSED') {
    return null;
  }

  if (reviewState === 'CAN_REVIEW') {
    return (
      <div className="rounded-lg border bg-blue-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Leave a Review</h3>
            <p className="text-sm text-gray-600">Share your experience to help other buyers</p>
          </div>
          <Link href={`/my/buying/orders/${orderId}/review`}>
            <Button className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Write Review
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (reviewState === 'CAN_EDIT') {
    return (
      <div className="rounded-lg border bg-green-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Review Submitted</h3>
            <p className="text-sm text-gray-600">
              You can still edit your review for {EDIT_WINDOW_HOURS} hours after posting
            </p>
          </div>
          <Link href={`/my/buying/orders/${orderId}/review`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Edit Review
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ALREADY_REVIEWED
  return (
    <div className="rounded-lg border bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-gray-600">
        <Star className="h-4 w-4 fill-gray-400 text-gray-400" />
        <span className="text-sm">You reviewed this order</span>
      </div>
    </div>
  );
}
