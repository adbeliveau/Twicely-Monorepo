/**
 * Seller profile ID resolution helpers for subscription queries.
 *
 * Extracted from subscriptions.ts to keep that module under 300 lines.
 * All existing imports from '@/lib/queries/subscriptions' continue to work
 * via the re-export in that file.
 */

import { db } from '@twicely/db';
import { sellerProfile } from '@/lib/db/schema/identity';
import { eq } from 'drizzle-orm';

/**
 * Get seller profile ID by user ID.
 */
export async function getSellerProfileIdByUserId(
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: sellerProfile.id })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Get user ID from seller profile ID.
 * Used by webhook handlers to resolve userId for credit operations.
 */
export async function getUserIdFromSellerProfileId(
  sellerProfileId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: sellerProfile.userId })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);
  return row?.userId ?? null;
}
