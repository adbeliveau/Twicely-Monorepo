/**
 * Stripe Trials — Free Trial Management
 *
 * Handles 14-day free trials for Store and Lister subscriptions.
 * Trial eligibility is tracked per product type per user.
 */

import { stripe } from '@twicely/stripe/server';
import { db } from '@twicely/db';
import { eq, and } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { trialUsage } from '@/lib/db/schema/subscriptions';
import { logger } from '@twicely/logger';

export type TrialProductType = 'STORE' | 'LISTER' | 'AUTOMATION';

const DEFAULT_TRIAL_PERIOD_DAYS = 14;
export const TRIAL_PERIOD_DAYS = DEFAULT_TRIAL_PERIOD_DAYS;

export interface TrialEligibilityResult {
  eligible: boolean;
  reason?: string;
  previousTrialDate?: Date;
}

export interface CreateTrialResult {
  success: boolean;
  subscriptionId?: string;
  trialEnd?: Date;
  error?: string;
}

/**
 * Check if a user is eligible for a free trial of a product.
 * Users get one trial per product type, ever.
 */
export async function checkTrialEligibility(
  userId: string,
  productType: TrialProductType
): Promise<TrialEligibilityResult> {
  try {
    // Check if user has already used a trial for this product type
    const [existing] = await db
      .select({
        trialStartedAt: trialUsage.trialStartedAt,
      })
      .from(trialUsage)
      .where(
        and(
          eq(trialUsage.userId, userId),
          eq(trialUsage.productType, productType)
        )
      )
      .limit(1);

    if (existing) {
      return {
        eligible: false,
        reason: 'You have already used your free trial for this product',
        previousTrialDate: existing.trialStartedAt,
      };
    }

    return { eligible: true };
  } catch (error) {
    logger.error('Error checking trial eligibility', { error });
    return {
      eligible: false,
      reason: 'Unable to check trial eligibility',
    };
  }
}

/**
 * Create a subscription with a 14-day free trial.
 * No payment method required to start trial.
 */
export async function createTrialSubscription(
  customerId: string,
  priceId: string,
  userId: string,
  productType: TrialProductType
): Promise<CreateTrialResult> {
  try {
    // Verify eligibility
    const eligibility = await checkTrialEligibility(userId, productType);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    // Create subscription with trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: await getPlatformSetting<number>('commerce.subscription.trialDays', DEFAULT_TRIAL_PERIOD_DAYS),
      payment_behavior: 'default_incomplete', // No immediate payment
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        userId,
        productType,
        isTrialSignup: 'true',
      },
    });

    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Record trial usage
    await db.insert(trialUsage).values({
      userId,
      productType,
      stripeSubscriptionId: subscription.id,
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      trialEnd,
    };
  } catch (error) {
    logger.error('Error creating trial subscription', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create trial subscription',
    };
  }
}

/**
 * Get remaining trial days for a subscription.
 * Returns negative values if trial has expired.
 */
export function getTrialDaysRemaining(trialEnd: Date): number {
  const now = new Date();
  const diff = trialEnd.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a subscription is currently in trial.
 */
export async function isSubscriptionInTrial(subscriptionId: string): Promise<boolean> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.status === 'trialing';
  } catch {
    return false;
  }
}

/**
 * Mark a trial as converted (when user adds payment method and continues).
 */
export async function markTrialConverted(subscriptionId: string): Promise<void> {
  await db
    .update(trialUsage)
    .set({
      convertedToSubscription: true,
      trialEndedAt: new Date(),
    })
    .where(eq(trialUsage.stripeSubscriptionId, subscriptionId));
}

/**
 * Mark a trial as ended without conversion (downgrade).
 */
export async function markTrialExpired(subscriptionId: string): Promise<void> {
  await db
    .update(trialUsage)
    .set({
      trialEndedAt: new Date(),
      convertedToSubscription: false,
    })
    .where(eq(trialUsage.stripeSubscriptionId, subscriptionId));
}

/**
 * Get trial info for display in UI.
 */
export interface TrialInfo {
  isInTrial: boolean;
  daysRemaining: number;
  trialEnd: Date | null;
  productType: TrialProductType | null;
}

export async function getTrialInfo(subscriptionId: string): Promise<TrialInfo | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (subscription.status !== 'trialing' || !subscription.trial_end) {
      return {
        isInTrial: false,
        daysRemaining: 0,
        trialEnd: null,
        productType: null,
      };
    }

    const trialEnd = new Date(subscription.trial_end * 1000);
    const productType = subscription.metadata?.productType as TrialProductType | undefined;

    return {
      isInTrial: true,
      daysRemaining: getTrialDaysRemaining(trialEnd),
      trialEnd,
      productType: productType ?? null,
    };
  } catch {
    return null;
  }
}
