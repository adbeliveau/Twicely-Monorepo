/**
 * BullMQ queue definition for the crosslister outbound publish pipeline.
 * Source: F3.1 install prompt §3.2; Lister Canonical Section 4.3
 *
 * Queue name: 'lister:publish'
 * Other queues (emergency-delist, polling, automation) are future phases.
 */

import { createQueue } from '@twicely/jobs/queue';
import { LISTER_PUBLISH_QUEUE } from '@twicely/crosslister/queue/constants';

export interface ListerPublishJobData {
  /** PK of the cross_job row */
  crossJobId: string;
  listingId: string;
  /** ExternalChannel value */
  channel: string;
  sellerId: string;
  accountId: string;
  projectionId: string;
  overrides: Record<string, unknown> | null;
  jobType: 'CREATE' | 'UPDATE' | 'DELIST' | 'SYNC';
}

export const listerPublishQueue = createQueue<ListerPublishJobData>(LISTER_PUBLISH_QUEUE);
