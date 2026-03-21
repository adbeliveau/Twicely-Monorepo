import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@twicely/auth';
import { db } from '@twicely/db';
import { order, buyerReview, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { BuyerReviewForm } from '@/components/pages/review/buyer-review-form';
import { formatDate } from '@twicely/utils/format';

export const dynamic = 'force-dynamic';

const EDIT_WINDOW_HOURS = 48;
const REVIEW_WINDOW_DAYS = 30;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SellerReviewPage({ params }: PageProps) {
  const { id: orderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const userId = session.user.id;

  // Fetch order details with buyer info
  const [orderRecord] = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      buyerName: user.name,
    })
    .from(order)
    .leftJoin(user, eq(order.buyerId, user.id))
    .where(eq(order.id, orderId))
    .limit(1);

  if (!orderRecord) {
    notFound();
  }

  // Verify user is the seller
  if (orderRecord.sellerId !== userId) {
    notFound();
  }

  // Format buyer display name
  const nameParts = (orderRecord.buyerName ?? 'Buyer').split(' ');
  const buyerDisplayName = nameParts[0] + (nameParts[1]?.[0] ? ` ${nameParts[1][0]}.` : '');

  // Check if review already exists
  const [existingReview] = await db
    .select({
      id: buyerReview.id,
      ratingPayment: buyerReview.ratingPayment,
      ratingCommunication: buyerReview.ratingCommunication,
      ratingReturnBehavior: buyerReview.ratingReturnBehavior,
      note: buyerReview.note,
      createdAt: buyerReview.createdAt,
    })
    .from(buyerReview)
    .where(eq(buyerReview.orderId, orderId))
    .limit(1);

  // Determine page state
  let pageState: 'CAN_REVIEW' | 'EDITING' | 'WINDOW_CLOSED' | 'ALREADY_REVIEWED' | 'ORDER_NOT_ELIGIBLE';

  // Check order eligibility
  if (orderRecord.status !== 'COMPLETED' && orderRecord.status !== 'DELIVERED') {
    pageState = 'ORDER_NOT_ELIGIBLE';
  } else if (existingReview) {
    // Check if still within edit window
    const now = new Date();
    const editWindowEnd = new Date(existingReview.createdAt);
    editWindowEnd.setHours(editWindowEnd.getHours() + EDIT_WINDOW_HOURS);

    if (now <= editWindowEnd) {
      pageState = 'EDITING';
    } else {
      pageState = 'ALREADY_REVIEWED';
    }
  } else {
    // Check if within review window
    if (!orderRecord.deliveredAt) {
      pageState = 'ORDER_NOT_ELIGIBLE';
    } else {
      const now = new Date();
      const windowEndDate = new Date(orderRecord.deliveredAt);
      windowEndDate.setDate(windowEndDate.getDate() + REVIEW_WINDOW_DAYS);

      if (now <= windowEndDate) {
        pageState = 'CAN_REVIEW';
      } else {
        pageState = 'WINDOW_CLOSED';
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/my/selling/orders/${orderId}`}
          className="text-sm text-primary hover:text-primary/80 mb-4 inline-block"
        >
          &larr; Back to order
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {pageState === 'EDITING' ? 'Edit Buyer Review' : 'Rate Buyer'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Order #{orderRecord.orderNumber} &bull; {buyerDisplayName}
          </p>
        </div>
      </div>

      {/* Page states */}
      {pageState === 'ORDER_NOT_ELIGIBLE' && (
        <div className="rounded-lg border bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">
            Order Not Eligible for Review
          </h2>
          <p className="text-sm text-yellow-800">
            You can only rate buyers for orders that have been delivered or completed.
          </p>
        </div>
      )}

      {pageState === 'WINDOW_CLOSED' && (
        <div className="rounded-lg border bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">
            Review Window Closed
          </h2>
          <p className="text-sm text-yellow-800">
            The review window for this order has closed. You had {REVIEW_WINDOW_DAYS} days after delivery to rate the buyer.
          </p>
        </div>
      )}

      {pageState === 'ALREADY_REVIEWED' && (
        <div className="rounded-lg border bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Review Already Submitted
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            You submitted your review on {existingReview && formatDate(existingReview.createdAt)}. The {EDIT_WINDOW_HOURS}-hour edit window has closed.
          </p>
          <Link
            href={`/my/selling/orders/${orderId}`}
            className="text-sm text-primary hover:text-primary/80"
          >
            View your order &rarr;
          </Link>
        </div>
      )}

      {(pageState === 'CAN_REVIEW' || pageState === 'EDITING') && (
        <div className="rounded-lg border bg-white p-6">
          {pageState === 'EDITING' && (
            <div className="mb-6 rounded-md bg-primary/10 p-4">
              <p className="text-sm text-primary">
                You can edit your review for {EDIT_WINDOW_HOURS} hours after posting. After that, reviews become permanent.
              </p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Rate your experience with {buyerDisplayName}</h2>
            <p className="text-sm text-gray-600">
              Your review helps other sellers understand what to expect from this buyer.
            </p>
          </div>

          <BuyerReviewForm
            orderId={orderId}
            mode={pageState === 'EDITING' ? 'edit' : 'create'}
            existingReview={existingReview ?? undefined}
          />
        </div>
      )}
    </div>
  );
}
