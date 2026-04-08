/**
 * Local Fraud No-Show Relist Check BullMQ Job (G2.15)
 *
 * Enqueued with 24-hour delay after a local transaction reaches NO_SHOW.
 * Checks if the seller relisted the item within the window — if so,
 * creates a STRONG_SIGNAL fraud flag (Signal 3).
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

import { createQueue, createWorker } from './queue';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

// ─── Callback Type (DI to avoid circular dep on @twicely/commerce) ───────────

export type NoshowRelistChecker = (
  localTransactionId: string,
  sellerId: string,
  orderId: string,
) => Promise<void>;

const QUEUE_NAME = 'local-fraud-noshow-relist';

// ─── Job Data ─────────────────────────────────────────────────────────────────

export interface LocalFraudNoshowRelistData {
  localTransactionId: string;
  sellerId: string;
  orderId: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export const localFraudNoshowRelistQueue =
  createQueue<LocalFraudNoshowRelistData>(QUEUE_NAME);

// ─── Enqueue Helper ───────────────────────────────────────────────────────────

/**
 * Enqueue the no-show relist check with a configurable delay.
 * Delay read from platform_settings: commerce.local.fraudNoshowRelistCheckHours (default 24).
 * jobId prevents duplicate checks for the same transaction.
 */
export async function enqueueNoshowRelistCheck(
  localTransactionId: string,
  sellerId: string,
  orderId: string,
): Promise<void> {
  const checkHours = await getPlatformSetting<number>(
    'commerce.local.fraudNoshowRelistCheckHours',
    24,
  );
  const delayMs = checkHours * 60 * 60 * 1000;

  await localFraudNoshowRelistQueue.add(
    'check',
    {
      localTransactionId,
      sellerId,
      orderId,
    },
    {
      delay: delayMs,
      jobId: `fraud-noshow-relist-${localTransactionId}`,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  logger.info('[local-fraud-noshow-relist] Enqueued no-show relist check', {
    localTransactionId,
    sellerId,
    checkHours,
  });
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Factory to create the no-show relist fraud check worker.
 * Accepts a NoshowRelistChecker to avoid circular dep on @twicely/commerce.
 */
export function createLocalFraudNoshowRelistWorker(
  checkNoshowRelist: NoshowRelistChecker,
) {
  return createWorker<LocalFraudNoshowRelistData>(
    QUEUE_NAME,
    async (job) => {
      const { localTransactionId, sellerId, orderId } = job.data;
      await checkNoshowRelist(localTransactionId, sellerId, orderId);
    },
    1,
  );
}

// ─── Auto-instantiated worker ────────────────────────────────────────────────
// Lazy-initialized after commerce module loads to avoid circular dep.

void (async () => {
  const { checkNoshowRelist } = await import('@twicely/commerce/local-fraud-detection');
  createLocalFraudNoshowRelistWorker(checkNoshowRelist);
})();
