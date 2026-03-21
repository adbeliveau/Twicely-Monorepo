/**
 * Trial Eligibility Query
 *
 * Wraps the core trial eligibility check for UI consumption.
 */

import { db } from '@twicely/db';
import { storeSubscription, sellerProfile } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkTrialEligibility, TRIAL_PERIOD_DAYS, type TrialProductType } from '@twicely/stripe/trials';

export interface TrialEligibilityInfo {
  eligible: boolean;
  trialDays: number;
  reason?: string;
  previousTrialDate?: Date;
}

export interface ActiveTrialInfo {
  isInTrial: boolean;
  trialEnd: Date;
  productName: string;
}

/**
 * Get trial eligibility information for a user and product type.
 * Returns a clean shape for UI components.
 */
export async function getTrialEligibility(
  userId: string,
  productType: TrialProductType
): Promise<TrialEligibilityInfo> {
  const result = await checkTrialEligibility(userId, productType);

  return {
    eligible: result.eligible,
    trialDays: TRIAL_PERIOD_DAYS,
    reason: result.reason,
    previousTrialDate: result.previousTrialDate,
  };
}

/**
 * Get active trial info for a seller (Store subscription).
 * Returns trial end date if currently in trial, null otherwise.
 */
export async function getActiveTrialInfo(userId: string): Promise<ActiveTrialInfo | null> {
  // Get seller profile first
  const [profile] = await db
    .select({ id: sellerProfile.id })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile) return null;

  // Check store subscription for active trial
  const [subscription] = await db
    .select({
      trialEndsAt: storeSubscription.trialEndsAt,
      status: storeSubscription.status,
    })
    .from(storeSubscription)
    .where(
      and(
        eq(storeSubscription.sellerProfileId, profile.id),
        eq(storeSubscription.status, 'TRIALING')
      )
    )
    .limit(1);

  if (!subscription?.trialEndsAt) return null;

  // Check if trial is still active
  if (subscription.trialEndsAt <= new Date()) return null;

  return {
    isInTrial: true,
    trialEnd: subscription.trialEndsAt,
    productName: 'Store Pro',
  };
}

/**
 * Get product display name for UI.
 */
export function getProductDisplayName(productType: TrialProductType): string {
  const names: Record<TrialProductType, string> = {
    STORE: 'Store Pro',
    LISTER: 'Lister Pro',
    AUTOMATION: 'Automation',
  };
  return names[productType] ?? productType;
}
