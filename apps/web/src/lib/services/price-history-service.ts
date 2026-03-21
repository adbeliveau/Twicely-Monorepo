import { db } from '@twicely/db';
import { listingPriceHistory } from '@twicely/db/schema';

export type PriceChangeReason = 'MANUAL' | 'PROMOTION' | 'COUPON' | 'SMART_DROP' | 'IMPORT' | 'OFFER_ACCEPTED';

interface RecordPriceChangeInput {
  listingId: string;
  newPriceCents: number;
  previousCents: number | null;
  changeReason: PriceChangeReason;
  changedByUserId?: string;
}

/**
 * Record a price change in listing price history.
 * Uses canonical column names per schema §27.1.
 */
export async function recordPriceChange(input: RecordPriceChangeInput): Promise<void> {
  const { listingId, newPriceCents, previousCents, changeReason, changedByUserId } = input;

  await db.insert(listingPriceHistory).values({
    listingId,
    priceCents: newPriceCents,
    previousCents,
    changeReason,
    changedByUserId: changedByUserId ?? null,
  });
}
