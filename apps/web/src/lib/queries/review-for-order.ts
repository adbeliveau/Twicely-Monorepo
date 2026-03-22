import { db } from '@twicely/db';
import { review } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

interface ReviewQueryResult {
  success: boolean;
  review?: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    photos: string[];
    dsrItemAsDescribed: number | null;
    dsrShippingSpeed: number | null;
    dsrCommunication: number | null;
    dsrPackaging: number | null;
    createdAt: Date;
    canEdit: boolean;
  };
  error?: string;
}

/**
 * Get review for an order (for display/edit purposes).
 */
export async function getReviewForOrder(orderId: string, userId: string): Promise<ReviewQueryResult> {
  const [reviewRecord] = await db
    .select({
      id: review.id,
      reviewerUserId: review.reviewerUserId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      photos: review.photos,
      dsrItemAsDescribed: review.dsrItemAsDescribed,
      dsrShippingSpeed: review.dsrShippingSpeed,
      dsrCommunication: review.dsrCommunication,
      dsrPackaging: review.dsrPackaging,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(eq(review.orderId, orderId))
    .limit(1);

  if (!reviewRecord) {
    return { success: false, error: 'No review found for this order' };
  }

  // Check if user can edit (ownership + within edit window)
  const editWindowHours = await getPlatformSetting<number>('trust.review.editWindowHours', 48);
  const now = new Date();
  const editWindowEnd = new Date(reviewRecord.createdAt);
  editWindowEnd.setHours(editWindowEnd.getHours() + editWindowHours);
  const canEdit = reviewRecord.reviewerUserId === userId && now <= editWindowEnd;

  return {
    success: true,
    review: {
      id: reviewRecord.id,
      rating: reviewRecord.rating,
      title: reviewRecord.title,
      body: reviewRecord.body,
      photos: reviewRecord.photos,
      dsrItemAsDescribed: reviewRecord.dsrItemAsDescribed,
      dsrShippingSpeed: reviewRecord.dsrShippingSpeed,
      dsrCommunication: reviewRecord.dsrCommunication,
      dsrPackaging: reviewRecord.dsrPackaging,
      createdAt: reviewRecord.createdAt,
      canEdit,
    },
  };
}
