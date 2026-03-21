import { db } from '@twicely/db';
import { shippingProfile, listing, sellerProfile } from '@twicely/db/schema';
import { eq, and, count } from 'drizzle-orm';

export interface ShippingProfileData {
  id: string;
  userId: string;
  name: string;
  carrier: string;
  service: string | null;
  handlingTimeDays: number;
  isDefault: boolean;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  combinedShippingMode: string;
  flatCombinedCents: number | null;
  additionalItemCents: number | null;
  autoDiscountPercent: number | null;
  autoDiscountMinItems: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all shipping profiles for a seller
 * Returns profiles sorted by isDefault DESC, then createdAt ASC
 */
export async function getSellerShippingProfiles(
  userId: string
): Promise<ShippingProfileData[]> {
  const profiles = await db
    .select()
    .from(shippingProfile)
    .where(eq(shippingProfile.userId, userId))
    .orderBy(shippingProfile.isDefault, shippingProfile.createdAt);

  return profiles;
}

/**
 * Get a single shipping profile by ID
 * Returns null if not found or not owned by user
 */
export async function getShippingProfileById(
  profileId: string,
  userId: string
): Promise<ShippingProfileData | null> {
  const [profile] = await db
    .select()
    .from(shippingProfile)
    .where(
      and(
        eq(shippingProfile.id, profileId),
        eq(shippingProfile.userId, userId)
      )
    )
    .limit(1);

  return profile ?? null;
}

/**
 * Get count of active listings using this shipping profile
 * Used to prevent deletion of in-use profiles
 */
export async function getShippingProfileListingCount(
  profileId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(listing)
    .where(
      and(
        eq(listing.shippingProfileId, profileId),
        eq(listing.status, 'ACTIVE')
      )
    );

  return result?.count ?? 0;
}

/**
 * Get seller's profile limit based on store tier
 * No Store: max 3 profiles, Store Starter+: max 10 profiles
 */
export async function getShippingProfileLimit(
  userId: string
): Promise<{ limit: number; currentCount: number }> {
  const [seller] = await db
    .select({ storeTier: sellerProfile.storeTier })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  const limit = seller?.storeTier && seller.storeTier !== 'NONE' ? 10 : 3;

  const [countResult] = await db
    .select({ count: count() })
    .from(shippingProfile)
    .where(eq(shippingProfile.userId, userId));

  return {
    limit,
    currentCount: countResult?.count ?? 0,
  };
}
