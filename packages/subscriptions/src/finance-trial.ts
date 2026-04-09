/**
 * Finance PRO 6-Month Trial — FC v3.0 §2
 *
 * Activates a free Finance PRO trial for a seller who has never used it.
 * Reads trial duration and repeatability from platform_settings.
 * Idempotent: safe to call multiple times; short-circuits if trial already used.
 */

import { db } from '@twicely/db';
import { financeSubscription, sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

export type FinanceTrialResult =
  | { activated: false; reason: 'TRIAL_ALREADY_USED' }
  | { activated: true; reason: 'TRIAL_ACTIVATED' };

/**
 * Activate the Finance PRO 6-month trial for a seller profile.
 *
 * Logic:
 * 1. Read or create financeSubscription row (tier: FREE, status: ACTIVE).
 * 2. If storeTierTrialUsed === true → return TRIAL_ALREADY_USED (unless repeatable).
 * 3. Read finance.storeTierTrialRepeatable and finance.storeTierTrialMonths from platform_settings.
 * 4. Compute storeTierTrialEndsAt = now + trialMonths months.
 * 5. Bundle case: if stripeSubscriptionId already set, only set flags (do NOT change tier).
 * 6. Transaction: update financeSubscription + sellerProfile.
 */
export async function activateFinanceProTrialIfEligible(
  sellerProfileId: string,
): Promise<FinanceTrialResult> {
  // Step 1: read existing financeSubscription
  const [existing] = await db
    .select({
      id: financeSubscription.id,
      storeTierTrialUsed: financeSubscription.storeTierTrialUsed,
      stripeSubscriptionId: financeSubscription.stripeSubscriptionId,
    })
    .from(financeSubscription)
    .where(eq(financeSubscription.sellerProfileId, sellerProfileId))
    .limit(1);

  // Create row if none exists
  if (!existing) {
    await db.insert(financeSubscription).values({
      sellerProfileId,
      tier: 'FREE',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    });
  }

  // Re-read after potential insert
  const [row] = existing
    ? [existing]
    : await db
        .select({
          id: financeSubscription.id,
          storeTierTrialUsed: financeSubscription.storeTierTrialUsed,
          stripeSubscriptionId: financeSubscription.stripeSubscriptionId,
        })
        .from(financeSubscription)
        .where(eq(financeSubscription.sellerProfileId, sellerProfileId))
        .limit(1);

  if (!row) {
    logger.error('[financeTrial] Failed to read financeSubscription after insert', { sellerProfileId });
    return { activated: false, reason: 'TRIAL_ALREADY_USED' };
  }

  // Step 2 & 3: check trial eligibility
  if (row.storeTierTrialUsed) {
    const repeatable = await getPlatformSetting<boolean>('finance.storeTierTrialRepeatable', false);
    if (!repeatable) {
      return { activated: false, reason: 'TRIAL_ALREADY_USED' };
    }
  }

  // Step 4: read trial duration
  const trialMonths = await getPlatformSetting<number>('finance.storeTierTrialMonths', 6);

  // Compute storeTierTrialEndsAt = now + trialMonths months
  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setMonth(trialEndsAt.getMonth() + trialMonths);

  // Step 5: bundle case — if stripeSubscriptionId set, only set flags (do NOT change tier)
  const hasBundleStripe = Boolean(row.stripeSubscriptionId);

  // Step 6: transaction — update financeSubscription and sellerProfile
  await db.transaction(async (tx) => {
    await tx
      .update(financeSubscription)
      .set({
        ...(hasBundleStripe ? {} : { tier: 'PRO' }),
        storeTierTrialUsed: true,
        storeTierTrialStartedAt: now,
        storeTierTrialEndsAt: trialEndsAt,
        updatedAt: now,
      })
      .where(eq(financeSubscription.sellerProfileId, sellerProfileId));

    if (!hasBundleStripe) {
      await tx
        .update(sellerProfile)
        .set({ financeTier: 'PRO', updatedAt: now })
        .where(eq(sellerProfile.id, sellerProfileId));
    }
  });

  logger.info('[financeTrial] Finance PRO trial activated', { sellerProfileId, trialEndsAt });

  return { activated: true, reason: 'TRIAL_ACTIVATED' };
}
