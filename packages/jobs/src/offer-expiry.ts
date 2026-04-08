import { createQueue, createWorker } from './queue';

// ─── Callback Type (DI to avoid circular dep on @twicely/commerce) ───────────

export type OfferExpirer = (offerId: string) => Promise<{ success: boolean; error?: string }>;

interface OfferExpiryJobData {
  offerId: string;
}

const QUEUE_NAME = 'offer-expiry';

/**
 * Queue for scheduling offer expiry jobs.
 * Jobs are delayed until the offer's expiresAt time.
 */
export const offerExpiryQueue = createQueue<OfferExpiryJobData>(QUEUE_NAME);

/**
 * Schedule an offer to expire at a specific time.
 * Uses jobId = `offer-expiry-${offerId}` for idempotency and cancellation.
 */
export async function scheduleOfferExpiry(offerId: string, expiresAt: Date): Promise<void> {
  const delay = Math.max(0, expiresAt.getTime() - Date.now());
  const jobId = `offer-expiry-${offerId}`;

  await offerExpiryQueue.add(
    'expire',
    { offerId },
    {
      jobId,
      delay,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

/**
 * Cancel a scheduled offer expiry job.
 * Called when offer is accepted, declined, canceled, or countered.
 */
export async function cancelOfferExpiry(offerId: string): Promise<void> {
  const jobId = `offer-expiry-${offerId}`;

  try {
    const job = await offerExpiryQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch {
    // Job may not exist or already processed — ignore
  }
}

/**
 * Factory to create the offer expiry worker.
 * Accepts an OfferExpirer callback to avoid circular dep on @twicely/commerce.
 */
export function createOfferExpiryWorker(expireOffer: OfferExpirer) {
  return createWorker<OfferExpiryJobData>(
    QUEUE_NAME,
    async (job) => {
      const { offerId } = job.data;
      const result = await expireOffer(offerId);

      if (!result.success && result.error !== 'Offer not found') {
        console.error(`[offer-expiry] Failed to expire offer ${offerId}:`, result.error);
      }
    }
  );
}

// ─── Auto-instantiated worker ────────────────────────────────────────────────
// Lazy-initialized after commerce loads to avoid circular dep.

void (async () => {
  const { expireOffer } = await import('@twicely/commerce/offer-engine');
  createOfferExpiryWorker(expireOffer);
})();