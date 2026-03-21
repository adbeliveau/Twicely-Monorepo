import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { logger } from '@twicely/logger';

/**
 * Auto-end expired vacation modes.
 * Finds sellers where vacationMode=true and vacationEndAt <= now,
 * then clears their vacation state.
 * Called by the nightly platform-cron job.
 */
export async function processVacationAutoEnd(): Promise<number> {
  const now = new Date();

  const expired = await db
    .select({ userId: sellerProfile.userId })
    .from(sellerProfile)
    .where(
      and(
        eq(sellerProfile.vacationMode, true),
        isNotNull(sellerProfile.vacationEndAt),
        lte(sellerProfile.vacationEndAt, now),
      )
    );

  if (expired.length === 0) {
    return 0;
  }

  let count = 0;
  for (const seller of expired) {
    await db
      .update(sellerProfile)
      .set({
        vacationMode: false,
        vacationModeType: null,
        vacationMessage: null,
        vacationAutoReplyMessage: null,
        vacationStartAt: null,
        vacationEndAt: null,
        updatedAt: now,
      })
      .where(eq(sellerProfile.userId, seller.userId));

    count++;
    logger.info('[vacationCron] Ended vacation', { userId: seller.userId });
  }

  return count;
}
