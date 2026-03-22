import { db } from '@twicely/db';
import { listing, category, categoryAlert } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { formatPrice } from '@twicely/utils/format';
import { logger } from '@twicely/logger';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

/**
 * Notify all users with matching category alerts when a new listing is activated.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyCategoryAlertMatches(listingId: string): Promise<void> {
  try {
    // Get listing with category
    const [listingRow] = await db
      .select({
        title: listing.title,
        slug: listing.slug,
        priceCents: listing.priceCents,
        categoryId: listing.categoryId,
        ownerUserId: listing.ownerUserId,
      })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!listingRow || !listingRow.categoryId) return;

    // Get category name
    const [categoryRow] = await db
      .select({ name: category.name })
      .from(category)
      .where(eq(category.id, listingRow.categoryId))
      .limit(1);

    if (!categoryRow) return;

    // Get all active category alerts for this category
    const alerts = await db
      .select({
        id: categoryAlert.id,
        userId: categoryAlert.userId,
      })
      .from(categoryAlert)
      .where(
        and(
          eq(categoryAlert.categoryId, listingRow.categoryId),
          eq(categoryAlert.isActive, true)
        )
      );

    // Exclude listing owner from notifications
    const matching = alerts.filter((alert) => alert.userId !== listingRow.ownerUserId);

    // Fire-and-forget each notification
    for (const alert of matching) {
      notify(alert.userId, 'search.new_match', {
        categoryName: categoryRow.name,
        itemTitle: listingRow.title ?? 'Item',
        priceFormatted: formatPrice(listingRow.priceCents ?? 0),
        listingUrl: `${BASE_URL}/i/${listingRow.slug}`,
      }).catch(() => {});
    }
  } catch (err) {
    logger.error('[notifyCategoryAlertMatches] Error', { error: String(err) });
  }
}
