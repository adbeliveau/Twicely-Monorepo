/**
 * BullMQ queue definition for emergency delist jobs.
 * Highest priority queue in the crosslister system (priority 0).
 * Source: F5-S1 install prompt §1.2, §3; Lister Canonical §4.3 (queue: lister:emergency-delist), §8.2
 *
 * Separate from lister:publish to ensure emergency delists are never blocked
 * by a large backlog of regular publish jobs.
 */

import { createQueue } from '@twicely/jobs/queue';

export const EMERGENCY_DELIST_QUEUE = 'lister-emergency-delist';

export interface EmergencyDelistJobData {
  /** PK of the channel_projection to delist */
  projectionId: string;
  /** Twicely canonical listing ID */
  listingId: string;
  /** The channel to delist from */
  channel: string;
  /** Why this delist was triggered */
  reason: 'SALE_DETECTED';
  /** Which channel triggered the emergency (the channel that sold) */
  sourceChannel: string;
  /** The external order/transaction ID from the sale that triggered this */
  sourceSaleId: string;
}

export const emergencyDelistQueue = createQueue<EmergencyDelistJobData>(EMERGENCY_DELIST_QUEUE);
