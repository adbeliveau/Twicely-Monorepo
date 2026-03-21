import { db } from '@twicely/db';
import { priceAlert, listing, listingImage } from '@twicely/db/schema';
import { eq, and, sql, desc, isNull, or } from 'drizzle-orm';

export type PriceAlertType = 'ANY_DROP' | 'TARGET_PRICE' | 'PERCENT_DROP' | 'BACK_IN_STOCK';

export interface PriceAlertWithListing {
  id: string;
  alertType: PriceAlertType;
  targetPriceCents: number | null;
  percentDrop: number | null;
  isActive: boolean;
  lastTriggeredAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  listing: {
    id: string;
    title: string | null;
    slug: string;
    priceCents: number | null;
    status: string;
    imageUrl: string | null;
  };
}

/**
 * Get all price alerts for a user with listing details.
 */
export async function getUserPriceAlerts(userId: string): Promise<PriceAlertWithListing[]> {
  const alerts = await db
    .select({
      id: priceAlert.id,
      alertType: priceAlert.alertType,
      targetPriceCents: priceAlert.targetPriceCents,
      percentDrop: priceAlert.percentDrop,
      isActive: priceAlert.isActive,
      lastTriggeredAt: priceAlert.lastTriggeredAt,
      expiresAt: priceAlert.expiresAt,
      createdAt: priceAlert.createdAt,
      listingId: listing.id,
      listingTitle: listing.title,
      listingSlug: listing.slug,
      listingPriceCents: listing.priceCents,
      listingStatus: listing.status,
    })
    .from(priceAlert)
    .innerJoin(listing, eq(listing.id, priceAlert.listingId))
    .where(eq(priceAlert.userId, userId))
    .orderBy(desc(priceAlert.createdAt));

  // Get primary images for all listings
  const listingIds = alerts.map((a) => a.listingId).filter(Boolean);
  const images =
    listingIds.length > 0
      ? await db
          .select({ listingId: listingImage.listingId, url: listingImage.url })
          .from(listingImage)
          .where(
            and(
              sql`${listingImage.listingId} IN ${listingIds}`,
              eq(listingImage.isPrimary, true)
            )
          )
      : [];

  const imageMap = new Map(images.map((i) => [i.listingId, i.url]));

  // Filter out any alerts where listing is somehow null (shouldn't happen with INNER JOIN)
  return alerts
    .filter((alert): alert is typeof alert & { listingId: string; listingSlug: string } =>
      alert.listingId !== null && alert.listingSlug !== null
    )
    .map((alert) => ({
      id: alert.id,
      alertType: alert.alertType as PriceAlertType,
      targetPriceCents: alert.targetPriceCents,
      percentDrop: alert.percentDrop,
      isActive: alert.isActive,
      lastTriggeredAt: alert.lastTriggeredAt,
      expiresAt: alert.expiresAt,
      createdAt: alert.createdAt,
      listing: {
        id: alert.listingId,
        title: alert.listingTitle,
        slug: alert.listingSlug,
        priceCents: alert.listingPriceCents,
        status: alert.listingStatus,
        imageUrl: imageMap.get(alert.listingId) ?? null,
      },
    }));
}

/**
 * Get all active, non-expired alerts for a specific listing.
 * Used by the price alert processor when a price changes.
 */
export async function getActiveAlertsForListing(listingId: string): Promise<
  Array<{
    id: string;
    userId: string;
    alertType: PriceAlertType;
    targetPriceCents: number | null;
    percentDrop: number | null;
    priceCentsAtCreation: number | null;
  }>
> {
  const alerts = await db
    .select({
      id: priceAlert.id,
      userId: priceAlert.userId,
      alertType: priceAlert.alertType,
      targetPriceCents: priceAlert.targetPriceCents,
      percentDrop: priceAlert.percentDrop,
      priceCentsAtCreation: priceAlert.priceCentsAtCreation,
    })
    .from(priceAlert)
    .where(
      and(
        eq(priceAlert.listingId, listingId),
        eq(priceAlert.isActive, true),
        or(isNull(priceAlert.expiresAt), sql`${priceAlert.expiresAt} > NOW()`)
      )
    );

  return alerts.map((a) => ({
    ...a,
    alertType: a.alertType as PriceAlertType,
  }));
}

/**
 * Get count of active price alerts for a user.
 */
export async function getPriceAlertCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(priceAlert)
    .where(and(eq(priceAlert.userId, userId), eq(priceAlert.isActive, true)));

  return result?.count ?? 0;
}

/**
 * Get user's price alert for a specific listing (if exists).
 */
export async function getUserAlertForListing(
  userId: string,
  listingId: string
): Promise<{
  id: string;
  alertType: PriceAlertType;
  targetPriceCents: number | null;
  percentDrop: number | null;
} | null> {
  const [alert] = await db
    .select({
      id: priceAlert.id,
      alertType: priceAlert.alertType,
      targetPriceCents: priceAlert.targetPriceCents,
      percentDrop: priceAlert.percentDrop,
    })
    .from(priceAlert)
    .where(
      and(
        eq(priceAlert.userId, userId),
        eq(priceAlert.listingId, listingId),
        eq(priceAlert.isActive, true),
        or(isNull(priceAlert.expiresAt), sql`${priceAlert.expiresAt} > NOW()`)
      )
    )
    .limit(1);

  if (!alert) return null;

  return {
    ...alert,
    alertType: alert.alertType as PriceAlertType,
  };
}

/**
 * Get all BACK_IN_STOCK alerts for a specific listing.
 * Used when a listing transitions from SOLD/ENDED to ACTIVE.
 */
export async function getBackInStockAlerts(listingId: string): Promise<
  Array<{ id: string; userId: string }>
> {
  return db
    .select({ id: priceAlert.id, userId: priceAlert.userId })
    .from(priceAlert)
    .where(
      and(
        eq(priceAlert.listingId, listingId),
        eq(priceAlert.alertType, 'BACK_IN_STOCK'),
        eq(priceAlert.isActive, true),
        or(isNull(priceAlert.expiresAt), sql`${priceAlert.expiresAt} > NOW()`)
      )
    );
}
