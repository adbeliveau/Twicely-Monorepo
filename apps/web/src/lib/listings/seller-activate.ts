import { db } from '@twicely/db';
import { user, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

/**
 * Ensure a user has a seller profile.
 * Creates one if it doesn't exist, and sets user.isSeller = true.
 * Called on first listing creation.
 */
export async function ensureSellerProfile(userId: string): Promise<void> {
  // Check if seller profile already exists
  const existing = await db
    .select({ id: sellerProfile.id })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    // Ensure status is ACTIVE and user.isSeller is true (fix incomplete activations)
    await db
      .update(sellerProfile)
      .set({ status: 'ACTIVE' })
      .where(eq(sellerProfile.userId, userId));
    await db
      .update(user)
      .set({ isSeller: true })
      .where(eq(user.id, userId));
    return;
  }

  // Create seller profile and update user.isSeller in a transaction
  const freeTierMonths = await getPlatformSetting<number>('crosslister.freeTierMonths', 6);
  const listerFreeExpiresAt = new Date(
    Date.now() + freeTierMonths * 30 * 24 * 60 * 60 * 1000
  );

  await db.transaction(async (tx) => {
    // Create seller profile with FREE lister tier teaser
    await tx.insert(sellerProfile).values({
      userId,
      status: 'ACTIVE',
      sellerType: 'PERSONAL',
      listerTier: 'FREE',
      listerFreeExpiresAt,
    });

    // Mark user as seller
    await tx
      .update(user)
      .set({ isSeller: true })
      .where(eq(user.id, userId));
  });
}
