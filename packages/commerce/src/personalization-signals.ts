import { db } from '@twicely/db';
import { userInterest, interestTag } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

/**
 * Record a purchase signal for interest tracking.
 *
 * When a user purchases a listing, we check if its category matches any interest tags
 * and record (or refresh) a PURCHASE signal with weight 2.0 and 90-day expiry.
 *
 * @param userId - The user who made the purchase
 * @param categoryId - The category ID of the purchased listing
 */
export async function recordPurchaseSignal(userId: string, categoryId: string): Promise<void> {
  // Find all interest tags that include this category (SQL array containment)
  const matchingTags = await db
    .select({ slug: interestTag.slug })
    .from(interestTag)
    .where(
      and(
        eq(interestTag.isActive, true),
        sql`${categoryId} = ANY(${interestTag.categoryIds})`
      )
    );

  if (matchingTags.length === 0) return; // No match = silent return

  const purchaseWeight = await getPlatformSetting<number>('discovery.personalization.purchaseWeight', 2.0);
  const purchaseExpiryDays = await getPlatformSetting<number>('discovery.personalization.purchaseExpiryDays', 90);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + purchaseExpiryDays);

  // Upsert interest for each matching tag
  for (const tag of matchingTags) {
    await db
      .insert(userInterest)
      .values({
        id: createId(),
        userId,
        tagSlug: tag.slug,
        weight: purchaseWeight.toString(),
        source: 'PURCHASE',
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [userInterest.userId, userInterest.tagSlug, userInterest.source],
        set: {
          expiresAt,
          updatedAt: new Date(),
        },
      });
  }
}
