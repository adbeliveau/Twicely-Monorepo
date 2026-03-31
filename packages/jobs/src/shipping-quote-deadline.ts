import { createQueue, createWorker } from './queue';
import { db } from '@twicely/db';
import { combinedShippingQuote, order } from '@twicely/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { formatPrice } from '@twicely/utils/format';
import { resolveQuoteFinalPrice } from './shipping-quote-resolver';

const QUEUE_NAME = 'shipping-quote-deadline';

interface DeadlineCheckJobData {
  triggeredAt: string;
}

/**
 * Queue for the shipping quote deadline check job.
 * Runs every 15 minutes to detect expired QUOTED shipping quotes.
 */
export const shippingQuoteDeadlineQueue = createQueue<DeadlineCheckJobData>(QUEUE_NAME);

/**
 * Register the repeatable deadline check job.
 * Call once at app startup.
 */
export async function registerShippingQuoteDeadlineJob(): Promise<void> {
  await shippingQuoteDeadlineQueue.add(
    'check-deadlines',
    { triggeredAt: new Date().toISOString() },
    {
      jobId: 'shipping-quote-deadline-repeatable',
      repeat: { every: 15 * 60 * 1000 }, // every 15 minutes
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

/**
 * Process a batch of expired quotes.
 * For each expired quote: apply penalty discount, update order totals, notify buyer and seller.
 */
async function processExpiredQuotes(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(combinedShippingQuote)
    .where(
      and(
        eq(combinedShippingQuote.status, 'PENDING_SELLER'),
        lt(combinedShippingQuote.sellerDeadline, now)
      )
    );

  for (const quote of expired) {
    const penaltyDiscountPercent = quote.penaltyDiscountPercent ?? 25;

    const resolution = resolveQuoteFinalPrice({
      maxShippingCents: quote.maxShippingCents,
      quotedShippingCents: null, // seller has not quoted yet
      penaltyDiscountPercent,
    });

    // Update quote record
    await db
      .update(combinedShippingQuote)
      .set({
        status: 'PENALTY_APPLIED',
        penaltyApplied: true,
        finalShippingCents: resolution.finalShippingCents,
        savingsCents: resolution.savingsCents,
        updatedAt: now,
      })
      .where(eq(combinedShippingQuote.id, quote.id));

    // Update order shipping and total
    const [ord] = await db
      .select({
        itemSubtotalCents: order.itemSubtotalCents,
        taxCents: order.taxCents,
        discountCents: order.discountCents,
      })
      .from(order)
      .where(eq(order.id, quote.orderId))
      .limit(1);

    if (ord) {
      const totalCents =
        ord.itemSubtotalCents +
        resolution.finalShippingCents +
        ord.taxCents -
        ord.discountCents;
      await db
        .update(order)
        .set({
          shippingCents: resolution.finalShippingCents,
          totalCents,
          updatedAt: now,
        })
        .where(eq(order.id, quote.orderId));
    }

    const originalFormatted = formatPrice(quote.maxShippingCents);
    const discountedFormatted = formatPrice(resolution.finalShippingCents);
    const savingsFormatted = formatPrice(resolution.savingsCents);

    // Notify buyer
    void notify(quote.buyerId, 'shipping_quote.penalty_applied', {
      orderNumber: quote.orderId,
      originalShippingFormatted: originalFormatted,
      discountedShippingFormatted: discountedFormatted,
      savingsFormatted,
    });

    // Notify seller
    void notify(quote.sellerId, 'shipping_quote.deadline_missed', {
      orderNumber: quote.orderId,
      penaltyPercent: String(penaltyDiscountPercent),
      discountedShippingFormatted: discountedFormatted,
    });
  }
}

/**
 * Worker that processes the shipping quote deadline check.
 */
export const shippingQuoteDeadlineWorker =
  createWorker<DeadlineCheckJobData>(
    QUEUE_NAME,
    async () => {
      await processExpiredQuotes();
    },
    1 // single concurrency — avoid duplicate processing
  );