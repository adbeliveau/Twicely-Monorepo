/**
 * BullMQ queue definition for the crosslister polling pipeline.
 * Source: Lister Canonical §13.4 (Adaptive Polling Engine)
 *
 * Queue name: 'lister-polling'
 * Producer:  poll-scheduler.ts (runs on a cron tick, finds due projections,
 *            enqueues POLL jobs here)
 * Consumer:  polling-worker.ts (FUTURE — calls connector for each platform,
 *            parses response, hands off to sale-detection on hits)
 *
 * The producer side is fully wired. The consumer worker is a separate
 * implementation task (it touches every connector and the sale-detection
 * pipeline). Until the worker exists, jobs accumulate in the queue but
 * cause no production harm — they will be processed when the worker ships.
 */

import { createQueue } from '@twicely/jobs/queue';
import { LISTER_POLLING_QUEUE } from './constants';

export interface ListerPollingJobData {
  /** PK of the channel_projection row to poll */
  projectionId: string;
  /** ExternalChannel value: 'EBAY' | 'POSHMARK' | 'MERCARI' | etc. */
  channel: string;
  /** Owning seller's userId */
  sellerId: string;
  /** Listing on Twicely's side that the projection mirrors */
  listingId: string;
  /** Polling tier at dispatch time: 'HOT' | 'WARM' | 'COLD' | 'LONGTAIL' */
  pollTier: string;
  /** Timestamp the scheduler decided this poll was due (for lag metrics) */
  scheduledAt: string;
}

export const listerPollingQueue = createQueue<ListerPollingJobData>(LISTER_POLLING_QUEUE);
