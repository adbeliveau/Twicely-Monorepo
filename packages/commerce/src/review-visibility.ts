import { db } from '@twicely/db';
import { order, review, buyerReview } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

/**
 * Compute visibleAt for reviews after submission/edit.
 * - Both exist: visibleAt = max(createdAt) + editWindowHours (dual-blind)
 * - Only one: visibleAt = deliveredAt + windowDays (solo reveal)
 */
export async function updateReviewVisibility(orderId: string): Promise<void> {
  const editWindowHours = await getPlatformSetting<number>('trust.review.editWindowHours', 24);
  const windowDays = await getPlatformSetting<number>('trust.review.windowDays', 60);

  await db.transaction(async (tx) => {
    const [orderData] = await tx
      .select({ deliveredAt: order.deliveredAt })
      .from(order)
      .where(eq(order.id, orderId))
      .limit(1);

    if (!orderData?.deliveredAt) return;

    const [b2s] = await tx
      .select({ id: review.id, createdAt: review.createdAt })
      .from(review)
      .where(eq(review.orderId, orderId))
      .limit(1);

    const [s2b] = await tx
      .select({ id: buyerReview.id, createdAt: buyerReview.createdAt })
      .from(buyerReview)
      .where(eq(buyerReview.orderId, orderId))
      .limit(1);

    const now = new Date();

    if (b2s && s2b) {
      // Both: reveal after later edit window closes
      const laterCreatedAt = b2s.createdAt > s2b.createdAt ? b2s.createdAt : s2b.createdAt;
      const visibleAt = new Date(laterCreatedAt);
      visibleAt.setHours(visibleAt.getHours() + editWindowHours);

      await tx.update(review).set({ visibleAt, updatedAt: now }).where(eq(review.id, b2s.id));
      await tx.update(buyerReview).set({ visibleAt, updatedAt: now }).where(eq(buyerReview.id, s2b.id));
    } else if (b2s) {
      // Solo buyer→seller: reveal when review window closes
      const visibleAt = new Date(orderData.deliveredAt);
      visibleAt.setDate(visibleAt.getDate() + windowDays);
      await tx.update(review).set({ visibleAt, updatedAt: now }).where(eq(review.id, b2s.id));
    } else if (s2b) {
      // Solo seller→buyer: reveal when review window closes
      const visibleAt = new Date(orderData.deliveredAt);
      visibleAt.setDate(visibleAt.getDate() + windowDays);
      await tx.update(buyerReview).set({ visibleAt, updatedAt: now }).where(eq(buyerReview.id, s2b.id));
    }
  });
}
