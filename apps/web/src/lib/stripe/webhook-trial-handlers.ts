/**
 * Stripe Webhook Handlers — Trial Events
 *
 * Handles trial_will_end and subscription.updated (trial conversion/expiry).
 */

import type Stripe from 'stripe';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { markTrialConverted, markTrialExpired, getTrialDaysRemaining } from '@twicely/stripe/trials';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import type { WebhookResult } from '@twicely/stripe/webhooks';

/**
 * Subscription trial ending — notify seller.
 * Fires 3 days before trial ends.
 */
export async function handleTrialWillEnd(subscription: Stripe.Subscription): Promise<WebhookResult> {
  try {
    const userId = subscription.metadata?.userId;
    const productType = subscription.metadata?.productType;
    if (!userId) {
      logger.warn('Trial ending webhook missing userId metadata');
      return { handled: true };
    }

    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;

    if (trialEnd) {
      const daysRemaining = getTrialDaysRemaining(trialEnd);

      // Send trial ending notification
      await notify(userId, 'subscription.trial_ending', {
        recipientName: '', // Will be filled by service
        productName: productType ?? 'Twicely Store',
        daysRemaining: String(daysRemaining),
        trialEndDate: trialEnd.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }

    return { handled: true };
  } catch (error) {
    logger.error('Error handling customer.subscription.trial_will_end', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Subscription updated — handle trial expiry and tier changes.
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<WebhookResult> {
  try {
    const userId = subscription.metadata?.userId;
    const productType = subscription.metadata?.productType;
    if (!userId) {
      return { handled: true };
    }

    // Check if trial just ended (status changed from trialing to active/past_due/canceled)
    const previousStatus = (subscription as Stripe.Subscription & { previous_attributes?: { status?: string } })
      .previous_attributes?.status;

    if (previousStatus === 'trialing' && subscription.status !== 'trialing') {
      if (subscription.status === 'active') {
        // User converted — has payment method and subscription continues
        await markTrialConverted(subscription.id);
        logger.info('Trial converted', { userId });
      } else if (subscription.status === 'canceled' || subscription.status === 'past_due') {
        // Trial expired without conversion — downgrade to NONE tier
        await markTrialExpired(subscription.id);

        // Downgrade seller tier to NONE
        await db
          .update(sellerProfile)
          .set({
            storeTier: 'NONE',
            updatedAt: new Date(),
          })
          .where(eq(sellerProfile.userId, userId));

        // Send trial expired notification
        await notify(userId, 'subscription.trial_expired', {
          recipientName: '',
          productName: productType ?? 'Twicely Store',
        });

        logger.info('Trial expired, downgraded to NONE tier', { userId });
      }
    }

    return { handled: true };
  } catch (error) {
    logger.error('Error handling customer.subscription.updated', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
