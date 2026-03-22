import { logger } from '@twicely/logger';
import { db } from '@twicely/db';
import { priceAlert, listing, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { formatPrice } from '@twicely/utils/format';
import { getActiveAlertsForListing, getBackInStockAlerts } from '@/lib/queries/price-alerts';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://twicely.co';

interface ProcessResult {
  triggered: number;
  total: number;
}

/**
 * Process price alerts when a listing price changes.
 * Call this after recordPriceChange in the listing update flow.
 *
 * @param listingId - The listing that had a price change
 * @param newPriceCents - The new price
 * @param previousPriceCents - The previous price
 */
export async function processPriceAlerts(
  listingId: string,
  newPriceCents: number,
  previousPriceCents: number
): Promise<ProcessResult> {
  // Only process if price dropped
  if (newPriceCents >= previousPriceCents) {
    return { triggered: 0, total: 0 };
  }

  try {
    // Get listing details for notification
    const [listingRow] = await db
      .select({ title: listing.title, slug: listing.slug })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!listingRow) {
      return { triggered: 0, total: 0 };
    }

    // Get all active alerts for this listing
    const alerts = await getActiveAlertsForListing(listingId);
    let triggered = 0;

    for (const alert of alerts) {
      let shouldTrigger = false;

      switch (alert.alertType) {
        case 'ANY_DROP':
          // Any price decrease triggers
          shouldTrigger = true;
          break;

        case 'TARGET_PRICE':
          // Price dropped to or below target
          if (alert.targetPriceCents && newPriceCents <= alert.targetPriceCents) {
            shouldTrigger = true;
          }
          break;

        case 'PERCENT_DROP':
          // Calculate percent drop from price at alert creation (baseline)
          if (alert.percentDrop && alert.priceCentsAtCreation) {
            const actualDropPercent =
              ((alert.priceCentsAtCreation - newPriceCents) / alert.priceCentsAtCreation) * 100;
            if (actualDropPercent >= alert.percentDrop) {
              shouldTrigger = true;
            }
          }
          break;

        case 'BACK_IN_STOCK':
          // Handled separately in processBackInStockAlerts
          break;
      }

      if (shouldTrigger) {
        // Get user name for notification
        const [userRow] = await db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, alert.userId))
          .limit(1);

        // Build alert-type-specific message
        let alertMessage: string;
        const baselinePrice = alert.priceCentsAtCreation ?? previousPriceCents;
        switch (alert.alertType) {
          case 'ANY_DROP':
            alertMessage = `${listingRow.title ?? 'Item'} dropped from ${formatPrice(previousPriceCents)} to ${formatPrice(newPriceCents)}.`;
            break;
          case 'TARGET_PRICE':
            alertMessage = `${listingRow.title ?? 'Item'} hit your target price of ${formatPrice(alert.targetPriceCents ?? 0)}! Now ${formatPrice(newPriceCents)}.`;
            break;
          case 'PERCENT_DROP':
            alertMessage = `${listingRow.title ?? 'Item'} dropped ${alert.percentDrop ?? 0}%+ — now ${formatPrice(newPriceCents)} (was ${formatPrice(baselinePrice)}).`;
            break;
          default:
            alertMessage = `${listingRow.title ?? 'Item'} is now ${formatPrice(newPriceCents)}.`;
        }

        // Send notification using dedicated price_alert template
        notify(alert.userId, 'price_alert.triggered', {
          recipientName: userRow?.name ?? 'there',
          itemTitle: listingRow.title ?? 'Item',
          oldPriceFormatted: formatPrice(previousPriceCents),
          newPriceFormatted: formatPrice(newPriceCents),
          alertMessage,
          listingUrl: `${BASE_URL}/i/${listingRow.slug}`,
        }).catch((err) => {
          logger.error('[processPriceAlerts] Notification error', { error: String(err) });
        });

        // Mark alert as triggered (deactivate to prevent re-triggering)
        await db
          .update(priceAlert)
          .set({
            isActive: false,
            lastTriggeredAt: new Date(),
          })
          .where(eq(priceAlert.id, alert.id));

        triggered++;
      }
    }

    return { triggered, total: alerts.length };
  } catch (err) {
    logger.error('[processPriceAlerts] Error', { error: String(err) });
    return { triggered: 0, total: 0 };
  }
}

/**
 * Process BACK_IN_STOCK alerts when a listing status changes to ACTIVE.
 * Call this when a listing transitions from SOLD/ENDED to ACTIVE.
 *
 * @param listingId - The listing that became active again
 */
export async function processBackInStockAlerts(listingId: string): Promise<ProcessResult> {
  try {
    // Get listing details
    const [listingRow] = await db
      .select({ title: listing.title, slug: listing.slug, priceCents: listing.priceCents })
      .from(listing)
      .where(eq(listing.id, listingId))
      .limit(1);

    if (!listingRow) {
      return { triggered: 0, total: 0 };
    }

    // Get all BACK_IN_STOCK alerts for this listing
    const alerts = await getBackInStockAlerts(listingId);
    let triggered = 0;

    for (const alert of alerts) {
      // Get user name for notification
      const [userRow] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, alert.userId))
        .limit(1);

      // Send notification using dedicated back_in_stock template
      notify(alert.userId, 'price_alert.back_in_stock', {
        recipientName: userRow?.name ?? 'there',
        itemTitle: listingRow.title ?? 'Item',
        newPriceFormatted: formatPrice(listingRow.priceCents ?? 0),
        listingUrl: `${BASE_URL}/i/${listingRow.slug}`,
      }).catch((err) => {
        logger.error('[processBackInStockAlerts] Notification error', { error: String(err) });
      });

      // Mark alert as triggered
      await db
        .update(priceAlert)
        .set({
          isActive: false,
          lastTriggeredAt: new Date(),
        })
        .where(eq(priceAlert.id, alert.id));

      triggered++;
    }

    return { triggered, total: alerts.length };
  } catch (err) {
    logger.error('[processBackInStockAlerts] Error', { error: String(err) });
    return { triggered: 0, total: 0 };
  }
}
