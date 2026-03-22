'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { priceAlert, listing, browsingHistory } from '@twicely/db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { authorize } from '@twicely/casl';
import { createPriceAlertSchema, deletePriceAlertSchema } from '@/lib/validations/alerts';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export type PriceAlertType = 'ANY_DROP' | 'TARGET_PRICE' | 'PERCENT_DROP' | 'BACK_IN_STOCK';

interface ActionResult {
  success: boolean;
  alertId?: string;
  error?: string;
}

interface CreatePriceAlertInput {
  listingId: string;
  alertType: PriceAlertType;
  targetPriceCents?: number;
  targetPercentDrop?: number;
}

/**
 * Create a price alert for a listing.
 */
export async function createPriceAlertAction(
  input: CreatePriceAlertInput
): Promise<ActionResult> {
  const parsed = createPriceAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('create', 'Notification')) return { success: false, error: 'Not authorized' };

  const alertsEnabled = await getPlatformSetting<boolean>('discovery.priceAlert.enabled', true);
  if (!alertsEnabled) return { success: false, error: 'Price alerts are currently disabled' };

  // Read limits from platform_settings (with fallback defaults)
  const maxAlertsPerUser = await getPlatformSetting<number>('discovery.priceAlert.maxPerUser', 100);
  const defaultExpiryDays = await getPlatformSetting<number>('discovery.priceAlert.defaultExpiryDays', 90);

  const { listingId, alertType, targetPriceCents, targetPercentDrop } = parsed.data;

  // Get listing details
  const [listingRow] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      priceCents: listing.priceCents,
      status: listing.status,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, error: 'Listing not found' };
  }

  // Cannot set alert on own listing
  if (listingRow.ownerUserId === session.userId) {
    return { success: false, error: 'Cannot set alert on your own listing' };
  }

  // Validate alert type and parameters
  if (alertType === 'TARGET_PRICE') {
    if (!targetPriceCents || targetPriceCents <= 0) {
      return { success: false, error: 'Target price is required' };
    }
    if (listingRow.priceCents && targetPriceCents >= listingRow.priceCents) {
      return { success: false, error: 'Target price must be below current price' };
    }
  }

  if (alertType === 'PERCENT_DROP') {
    if (!targetPercentDrop || targetPercentDrop < 5 || targetPercentDrop > 50) {
      return { success: false, error: 'Percent drop must be between 5% and 50%' };
    }
  }

  // BACK_IN_STOCK only valid for SOLD/ENDED listings
  if (alertType === 'BACK_IN_STOCK') {
    if (listingRow.status !== 'SOLD' && listingRow.status !== 'ENDED') {
      return { success: false, error: 'Back in stock alerts only for sold or ended listings' };
    }
  }

  // Check user alert limit
  const [countResult] = await db
    .select({ count: count() })
    .from(priceAlert)
    .where(and(eq(priceAlert.userId, session.userId), eq(priceAlert.isActive, true)));

  if ((countResult?.count ?? 0) >= maxAlertsPerUser) {
    return { success: false, error: `Maximum ${maxAlertsPerUser} alerts allowed` };
  }

  // Check for duplicate alert on same listing with same type
  const [existing] = await db
    .select({ id: priceAlert.id })
    .from(priceAlert)
    .where(
      and(
        eq(priceAlert.userId, session.userId),
        eq(priceAlert.listingId, listingId),
        eq(priceAlert.alertType, alertType),
        eq(priceAlert.isActive, true)
      )
    )
    .limit(1);

  if (existing) {
    return { success: false, error: 'Alert already exists for this listing' };
  }

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + defaultExpiryDays);

  // Create alert (store current price for PERCENT_DROP baseline)
  const [newAlert] = await db
    .insert(priceAlert)
    .values({
      userId: session.userId,
      listingId,
      alertType,
      targetPriceCents: alertType === 'TARGET_PRICE' ? targetPriceCents : null,
      percentDrop: alertType === 'PERCENT_DROP' ? targetPercentDrop : null,
      priceCentsAtCreation: listingRow.priceCents,
      isActive: true,
      expiresAt,
    })
    .returning({ id: priceAlert.id });

  // Update browsing history engagement (direct DB update)
  db.update(browsingHistory)
    .set({ didSetPriceAlert: true })
    .where(
      and(
        eq(browsingHistory.userId, session.userId),
        eq(browsingHistory.listingId, listingId)
      )
    )
    .catch((err) => {
      logger.error('[createPriceAlertAction] Failed to update browsing history', { error: String(err) });
    });

  revalidatePath(`/i/`);
  revalidatePath('/my/buying/alerts');

  return { success: true, alertId: newAlert?.id };
}

/**
 * Delete a price alert.
 */
export async function deletePriceAlertAction(alertId: string): Promise<ActionResult> {
  const parsed = deletePriceAlertSchema.safeParse({ alertId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!ability.can('delete', 'Notification')) return { success: false, error: 'Not authorized' };

  // Verify ownership
  const [alertRow] = await db
    .select({ id: priceAlert.id, userId: priceAlert.userId })
    .from(priceAlert)
    .where(eq(priceAlert.id, alertId))
    .limit(1);

  if (!alertRow) {
    return { success: false, error: 'Alert not found' };
  }

  if (alertRow.userId !== session.userId) {
    return { success: false, error: 'Unauthorized' };
  }

  await db.delete(priceAlert).where(eq(priceAlert.id, alertId));

  revalidatePath('/my/buying/alerts');

  return { success: true };
}

/**
 * Get user's active price alert for a specific listing.
 * Returns the most restrictive alert (if multiple exist).
 */
export async function getUserPriceAlertForListing(
  listingId: string
): Promise<{ alertType: PriceAlertType; targetPriceCents?: number; percentDrop?: number; alertId: string } | null> {
  const { session } = await authorize();
  if (!session) return null;

  const alerts = await db
    .select({
      id: priceAlert.id,
      alertType: priceAlert.alertType,
      targetPriceCents: priceAlert.targetPriceCents,
      percentDrop: priceAlert.percentDrop,
    })
    .from(priceAlert)
    .where(
      and(
        eq(priceAlert.userId, session.userId),
        eq(priceAlert.listingId, listingId),
        eq(priceAlert.isActive, true),
        sql`${priceAlert.expiresAt} > NOW()`
      )
    )
    .limit(1);

  const alert = alerts[0];
  if (!alert) return null;

  return {
    alertType: alert.alertType as PriceAlertType,
    targetPriceCents: alert.targetPriceCents ?? undefined,
    percentDrop: alert.percentDrop ?? undefined,
    alertId: alert.id,
  };
}
