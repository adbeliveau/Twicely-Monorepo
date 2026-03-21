/**
 * BullMQ queue definition for the lister:automation queue.
 * Isolated from lister:publish to allow separate concurrency and priority handling.
 * Source: F6.1 install prompt §E.3; Lister Canonical Section 8.1.
 */

import { createQueue } from '@twicely/jobs/queue';
import { LISTER_AUTOMATION_QUEUE } from './constants';
import { AUTOMATION_MAX_ATTEMPTS, AUTOMATION_BACKOFF_DELAYS } from '../automation/constants';

export interface AutomationJobData {
  /** PK of the cross_job row */
  crossJobId: string;
  listingId: string;
  channel: string;
  sellerId: string;
  accountId: string;
  projectionId: string;
  jobType: 'RELIST' | 'UPDATE' | 'SYNC';
  /** The automation engine that created this job */
  automationEngine: 'AUTO_RELIST' | 'PRICE_DROP' | 'OFFER_TO_LIKERS' | 'POSH_SHARE' | 'POSH_FOLLOW';
  /** Job-type-specific payload */
  payload: Record<string, unknown>;
}

export const automationQueue = createQueue<AutomationJobData>(LISTER_AUTOMATION_QUEUE, {
  defaultJobOptions: {
    attempts: AUTOMATION_MAX_ATTEMPTS,
    backoff: {
      type: 'fixed',
      delay: AUTOMATION_BACKOFF_DELAYS[0], // 60s — BullMQ uses this for first retry
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
