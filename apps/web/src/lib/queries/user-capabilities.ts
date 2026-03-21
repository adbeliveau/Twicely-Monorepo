import { db } from '@twicely/db';
import { user, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type { UserCapabilities } from '@/types/hub';

/**
 * getUserCapabilities — loads all capability flags for hub navigation
 *
 * Reference: TWICELY_V3_UNIFIED_HUB_CANONICAL.md §5.2
 *
 * Used by the hub layout to determine which sidebar sections to show.
 * Returns sensible defaults for non-sellers.
 */
export async function getUserCapabilities(userId: string): Promise<UserCapabilities> {
  // Load user record for isSeller flag
  const [userRecord] = await db
    .select({
      isSeller: user.isSeller,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // Load seller profile if exists
  const [profile] = await db
    .select({
      sellerType: sellerProfile.sellerType,
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      hasAutomation: sellerProfile.hasAutomation,
      performanceBand: sellerProfile.performanceBand,
      status: sellerProfile.status,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  // Determine if truly a seller (flag + active profile)
  const isSeller = !!userRecord?.isSeller && profile?.status === 'ACTIVE';
  const sellerType = profile?.sellerType ?? 'PERSONAL';
  const storeTier = profile?.storeTier ?? null;
  const listerTier = profile?.listerTier ?? null;

  // TODO: Check for delegation (staff acting on behalf)
  // const delegation = await getActiveDelegation(userId);
  const isStaff = false;
  const delegatedScopes: string[] = [];

  return {
    isSeller,
    sellerType,
    storeTier,
    hasStore: isSeller && storeTier !== null && storeTier !== 'NONE' && sellerType === 'BUSINESS',
    listerTier,
    hasCrosslister: listerTier !== null && listerTier !== 'NONE',
    hasAutomation: profile?.hasAutomation ?? false,
    performanceBand: profile?.performanceBand ?? null,
    isStaff,
    delegatedScopes,
  };
}
