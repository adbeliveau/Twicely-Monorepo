/**
 * C5.3 — Shipping Exception Auto-Detection
 *
 * Automatic detection of shipping problems.
 * Runs on webhook/cron when tracking updates.
 *
 * Exception types:
 * - LOST_IN_TRANSIT: No tracking update in 7+ days after last scan
 * - DELIVERY_EXCEPTION: Carrier reports exception status
 * - SIGNIFICANT_DELAY: 14+ days past estimated delivery
 *
 * Note: This is a stub implementation. Real tracking integration comes later (Shippo).
 */

import { db } from '@twicely/db';
import { order, shipment, dispute } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// Exception thresholds
export const LOST_IN_TRANSIT_DAYS = 7;
export const SIGNIFICANT_DELAY_DAYS = 14;

export type ShippingExceptionType = 'LOST_IN_TRANSIT' | 'DELIVERY_EXCEPTION' | 'SIGNIFICANT_DELAY';

export interface ShippingException {
  orderId: string;
  type: ShippingExceptionType;
  detectedAt: Date;
  description: string;
}

interface TrackingEvent {
  timestamp: string;
  status: string;
  location?: string;
}

/**
 * Detect shipping exceptions for an order.
 * Returns null if no exception detected.
 */
export async function detectShippingException(orderId: string): Promise<ShippingException | null> {
  const [ord] = await db
    .select({
      id: order.id,
      status: order.status,
      expectedDeliveryAt: order.expectedDeliveryAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return null;
  }

  // Only check shipped/in-transit orders
  if (!['SHIPPED', 'IN_TRANSIT'].includes(ord.status)) {
    return null;
  }

  // Get shipment
  const [ship] = await db
    .select({
      tracking: shipment.tracking,
      status: shipment.status,
      shippedAt: shipment.shippedAt,
      trackingEventsJson: shipment.trackingEventsJson,
    })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
    .limit(1);

  if (!ship || !ship.shippedAt) {
    return null;
  }

  const now = new Date();

  // Check for DELIVERY_EXCEPTION status from carrier (specific exception statuses)
  if (['LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER'].includes(ship.status)) {
    const descriptions: Record<string, string> = {
      LOST: 'The carrier has marked your package as lost.',
      DAMAGED_IN_TRANSIT: 'The carrier reported your package was damaged in transit.',
      RETURN_TO_SENDER: 'Your package is being returned to sender.',
    };
    return {
      orderId,
      type: 'DELIVERY_EXCEPTION',
      detectedAt: now,
      description: descriptions[ship.status] ?? 'The carrier reported a delivery exception for your package.',
    };
  }

  const [lostDays, delayDays] = await Promise.all([
    getPlatformSetting<number>('commerce.shipping.lostInTransitDays', LOST_IN_TRANSIT_DAYS),
    getPlatformSetting<number>('commerce.shipping.significantDelayDays', SIGNIFICANT_DELAY_DAYS),
  ]);

  // Check for SIGNIFICANT_DELAY
  if (ord.expectedDeliveryAt) {
    const daysPastExpected = Math.floor(
      (now.getTime() - ord.expectedDeliveryAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysPastExpected >= delayDays) {
      return {
        orderId,
        type: 'SIGNIFICANT_DELAY',
        detectedAt: now,
        description: `Your package is ${daysPastExpected} days past the expected delivery date.`,
      };
    }
  }

  // Check for LOST_IN_TRANSIT (no tracking update in lostDays+ days)
  const trackingEvents = ship.trackingEventsJson as TrackingEvent[] | null;
  if (trackingEvents && trackingEvents.length > 0) {
    const lastEvent = trackingEvents[trackingEvents.length - 1];
    if (lastEvent) {
      const lastEventDate = new Date(lastEvent.timestamp);
      const daysSinceUpdate = Math.floor(
        (now.getTime() - lastEventDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysSinceUpdate >= lostDays) {
        return {
          orderId,
          type: 'LOST_IN_TRANSIT',
          detectedAt: now,
          description: `No tracking updates for ${daysSinceUpdate} days. Your package may be lost.`,
        };
      }
    }
  } else {
    // No tracking events at all - check days since shipped
    const daysSinceShipped = Math.floor(
      (now.getTime() - ship.shippedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceShipped >= lostDays) {
      return {
        orderId,
        type: 'LOST_IN_TRANSIT',
        detectedAt: now,
        description: `No tracking updates since shipment. Your package may be lost.`,
      };
    }
  }

  return null;
}

export interface AutoClaimResult {
  success: boolean;
  claimId?: string;
  error?: string;
}

/**
 * Auto-create a protection claim for a shipping exception.
 */
export async function autoCreateClaim(
  orderId: string,
  exception: ShippingException
): Promise<AutoClaimResult> {
  // Get order details
  const [ord] = await db
    .select({
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      orderNumber: order.orderNumber,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return { success: false, error: 'Order not found' };
  }

  // Check if claim already exists
  const [existing] = await db
    .select({ id: dispute.id })
    .from(dispute)
    .where(eq(dispute.orderId, orderId))
    .limit(1);

  if (existing) {
    return { success: false, error: 'Claim already exists for this order' };
  }

  const now = new Date();
  const reviewDeadlineHours = await getPlatformSetting<number>('commerce.dispute.reviewDeadlineHours', 48);

  // Create protection claim
  const [created] = await db
    .insert(dispute)
    .values({
      orderId,
      buyerId: ord.buyerId,
      sellerId: ord.sellerId,
      claimType: 'INR', // Shipping issues are treated as INR
      status: 'OPEN',
      description: `[Auto-detected] ${exception.description}`,
      evidencePhotos: [],
      deadlineAt: new Date(now.getTime() + reviewDeadlineHours * 60 * 60 * 1000),
    })
    .returning({ id: dispute.id });

  // Notify buyer
  await notify(ord.buyerId, 'shipping.exception', {
    orderNumber: ord.orderNumber,
    exceptionType: formatExceptionType(exception.type),
  });

  return { success: true, claimId: created?.id };
}

function formatExceptionType(type: ShippingExceptionType): string {
  switch (type) {
    case 'LOST_IN_TRANSIT':
      return 'Package may be lost in transit';
    case 'DELIVERY_EXCEPTION':
      return 'Delivery exception reported by carrier';
    case 'SIGNIFICANT_DELAY':
      return 'Package significantly delayed';
    default:
      return 'Shipping issue detected';
  }
}

/**
 * Scan all in-transit orders for shipping exceptions.
 * Called by scheduled job.
 */
export async function scanForShippingExceptions(): Promise<number> {
  // Get all shipped/in-transit orders without a claim
  const inTransitOrders = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.status, 'IN_TRANSIT'),
        // Orders without a claim - we'd need a left join for this
        // For now, just get all in-transit orders
      )
    );

  let exceptionsFound = 0;

  for (const ord of inTransitOrders) {
    const exception = await detectShippingException(ord.id);
    if (exception) {
      const result = await autoCreateClaim(ord.id, exception);
      if (result.success) {
        exceptionsFound++;
      }
    }
  }

  return exceptionsFound;
}

/**
 * Get shipping status for an order.
 */
export async function getShippingStatus(orderId: string) {
  const [ship] = await db
    .select({
      status: shipment.status,
      tracking: shipment.tracking,
      carrier: shipment.carrier,
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      expectedDeliveryAt: shipment.expectedDeliveryAt,
    })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
    .limit(1);

  return ship ?? null;
}
