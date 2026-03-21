'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { authorize, sub } from '@twicely/casl';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  updateAffiliateOptInSchema,
  updateAffiliateCommissionRateSchema,
} from '@/lib/validations/affiliate';

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Action 1: updateAffiliateOptIn ─────────────────────────────────────────

/**
 * Toggle whether the seller allows affiliate commissions on their listings.
 * Seller controls their OWN sellerProfile via userId.
 */
export async function updateAffiliateOptIn(input: unknown): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!session.isSeller) return { success: false, error: 'Sellers only' };

  if (!ability.can('update', sub('SellerProfile', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateAffiliateOptInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await db
    .update(sellerProfile)
    .set({ affiliateOptIn: parsed.data.optIn, updatedAt: new Date() })
    .where(eq(sellerProfile.userId, session.userId));

  revalidatePath('/my/selling/affiliate');
  return { success: true };
}

// ─── Action 2: updateAffiliateCommissionRate ─────────────────────────────────

/**
 * Set a custom listing commission rate for the seller's listings.
 * Passing null reverts to the platform default.
 * Rate is validated against platform min/max settings.
 */
export async function updateAffiliateCommissionRate(input: unknown): Promise<ActionResult> {
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!session.isSeller) return { success: false, error: 'Sellers only' };

  if (!ability.can('update', sub('SellerProfile', { userId: session.userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateAffiliateCommissionRateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const commissionBps = parsed.data.commissionBps;

  if (commissionBps !== null) {
    const [minBps, maxBps] = await Promise.all([
      getPlatformSetting<number>('affiliate.listingCommissionMinBps', 200),
      getPlatformSetting<number>('affiliate.listingCommissionMaxBps', 1000),
    ]);

    if (commissionBps < minBps || commissionBps > maxBps) {
      return {
        success: false,
        error: `Commission rate must be between ${minBps / 100}% and ${maxBps / 100}%`,
      };
    }
  }

  await db
    .update(sellerProfile)
    .set({ affiliateCommissionBps: commissionBps, updatedAt: new Date() })
    .where(eq(sellerProfile.userId, session.userId));

  revalidatePath('/my/selling/affiliate');
  return { success: true };
}
