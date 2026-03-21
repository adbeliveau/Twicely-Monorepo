import { db } from '@twicely/db';
import { businessInfo } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';

export type BusinessInfoRecord = typeof businessInfo.$inferSelect;

/**
 * Get business info for a user.
 * Returns null if no business info record exists.
 */
export async function getBusinessInfo(userId: string): Promise<BusinessInfoRecord | null> {
  const [row] = await db
    .select()
    .from(businessInfo)
    .where(eq(businessInfo.userId, userId))
    .limit(1);

  return row ?? null;
}
