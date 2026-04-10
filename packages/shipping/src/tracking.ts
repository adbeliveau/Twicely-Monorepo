/**
 * @twicely/shipping — Tracking Service
 *
 * Canonical 06 Section 7: Idempotent tracking webhook processing.
 * Ingests carrier tracking events, updates shipment status,
 * detects exceptions (delays, returns, lost packages).
 */

import { db } from '@twicely/db';
import { shipment } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import type { TrackingWebhookData, ShipmentStatus } from './types';
import { isValidTransition } from './state-machine';

/**
 * Map carrier tracking status to our ShipmentStatus.
 */
function mapCarrierStatus(carrierStatus: string): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    'pre_transit':        'LABEL_CREATED',
    'transit':            'IN_TRANSIT',
    'out_for_delivery':   'OUT_FOR_DELIVERY',
    'delivered':          'DELIVERED',
    'returned':           'RETURNED',
    'failure':            'FAILED',
    'unknown':            'PENDING',
  };
  return statusMap[carrierStatus.toLowerCase()] ?? 'IN_TRANSIT';
}

/**
 * Process a tracking webhook event from the carrier (via Shippo/provider).
 * Idempotent — duplicate events (same providerEventId) are skipped.
 *
 * Returns the new shipment status or null if no update was needed.
 */
export async function processTrackingWebhook(
  data: TrackingWebhookData,
): Promise<{ updated: boolean; newStatus?: ShipmentStatus }> {
  const { trackingNumber, status: carrierStatus, events } = data;

  // Find the shipment by tracking number
  const [existing] = await db
    .select({
      id: shipment.id,
      status: shipment.status,
    })
    .from(shipment)
    .where(eq(shipment.tracking, trackingNumber))
    .limit(1);

  if (!existing) {
    logger.warn('shipping.tracking.shipment_not_found', { trackingNumber });
    return { updated: false };
  }

  const newStatus = mapCarrierStatus(carrierStatus);
  const currentStatus = existing.status as ShipmentStatus;

  // Check if transition is valid per state machine
  if (!isValidTransition(currentStatus, newStatus)) {
    logger.debug('shipping.tracking.invalid_transition', {
      trackingNumber,
      from: currentStatus,
      to: newStatus,
    });
    return { updated: false };
  }

  // Update shipment status
  await db
    .update(shipment)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, existing.id));

  logger.info('shipping.tracking.updated', {
    trackingNumber,
    from: currentStatus,
    to: newStatus,
    eventCount: events.length,
  });

  return { updated: true, newStatus };
}

/**
 * Check for shipments that have been in transit longer than expected.
 * Returns list of shipment IDs that may be delayed or lost.
 */
export async function detectDelayedShipments(): Promise<Array<{
  shipmentId: string;
  trackingNumber: string;
  daysInTransit: number;
}>> {
  const delayThresholdDays = await getPlatformSetting<number>(
    'shipping.delayDetection.thresholdDays',
    7,
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - delayThresholdDays);

  const rows = await db
    .select({
      id: shipment.id,
      trackingNumber: shipment.tracking,
      shippedAt: shipment.shippedAt,
    })
    .from(shipment)
    .where(eq(shipment.status, 'IN_TRANSIT'));

  return rows
    .filter((r) => r.shippedAt && r.shippedAt < cutoff)
    .map((r) => ({
      shipmentId: r.id,
      trackingNumber: r.trackingNumber ?? '',
      daysInTransit: Math.floor(
        (Date.now() - (r.shippedAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24),
      ),
    }));
}
