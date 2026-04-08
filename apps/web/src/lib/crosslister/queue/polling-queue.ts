/**
 * BullMQ queue definition for the crosslister polling pipeline.
 * Source: Lister Canonical §13.4 (Adaptive Polling Engine)
 *
 * Mirror of packages/crosslister/src/queue/polling-queue.ts —
 * apps/web aliases @twicely/crosslister to ./src/lib/crosslister and needs
 * its own copy until the monorepo duplicate-file pattern is consolidated.
 *
 * Queue name: 'lister-polling'
 * Producer:   poll-scheduler.ts
 * Consumer:   polling-worker.ts (FUTURE)
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
