import { eq, and } from 'drizzle-orm';
import { db } from '@twicely/db';
import { aiAutofillUsage, sellerProfile } from '@twicely/db/schema';

/**
 * Get the autofill usage record for a given user and month key.
 * Returns null if no record exists yet.
 */
export async function getAutofillUsage(
  userId: string,
  monthKey: string
): Promise<{ count: number } | null> {
  const [row] = await db
    .select({ count: aiAutofillUsage.count })
    .from(aiAutofillUsage)
    .where(
      and(
        eq(aiAutofillUsage.userId, userId),
        eq(aiAutofillUsage.monthKey, monthKey)
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Get the storeTier for a given userId.
 * Returns 'NONE' if no sellerProfile exists.
 */
export async function getUserStoreTier(userId: string): Promise<string> {
  const [row] = await db
    .select({ storeTier: sellerProfile.storeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  return row?.storeTier ?? 'NONE';
}
