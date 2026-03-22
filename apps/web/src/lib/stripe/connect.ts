/**
 * Stripe Connect — Express Account Management
 *
 * Handles seller onboarding, account management, and Connect webhooks.
 * Platform uses destination charges pattern with application_fee.
 */

import { stripe } from '@twicely/stripe/server';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { logger } from '@twicely/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface CreateAccountResult {
  success: boolean;
  accountId?: string;
  error?: string;
}

export interface OnboardingLinkResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface AccountStatusResult {
  success: boolean;
  status?: {
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requiresAction: boolean;
    currentlyDue: string[];
  };
  error?: string;
}

/**
 * Create a Stripe Express account for a seller.
 * Called when seller first starts onboarding.
 */
export async function createConnectAccount(
  userId: string,
  email: string
): Promise<CreateAccountResult> {
  try {
    // Check if seller already has a Stripe account
    const [profile] = await db
      .select({ stripeAccountId: sellerProfile.stripeAccountId })
      .from(sellerProfile)
      .where(eq(sellerProfile.userId, userId))
      .limit(1);

    if (profile?.stripeAccountId) {
      return { success: true, accountId: profile.stripeAccountId };
    }

    // Create Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email,
      metadata: {
        userId,
        platform: 'twicely',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Store account ID on seller profile
    await db
      .update(sellerProfile)
      .set({
        stripeAccountId: account.id,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfile.userId, userId));

    return { success: true, accountId: account.id };
  } catch (error) {
    logger.error('Failed to create Connect account', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create account',
    };
  }
}

/**
 * Create an onboarding link for seller to complete Stripe setup.
 * Returns URL to redirect seller to Stripe's hosted onboarding.
 */
export async function createOnboardingLink(
  accountId: string,
  returnPath: string = '/my/selling/finances/return',
  refreshPath: string = '/my/selling/finances/setup'
): Promise<OnboardingLinkResult> {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}${refreshPath}`,
      return_url: `${APP_URL}${returnPath}`,
      type: 'account_onboarding',
    });

    return { success: true, url: accountLink.url };
  } catch (error) {
    logger.error('Failed to create onboarding link', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create onboarding link',
    };
  }
}

/**
 * Get current status of a Connect account.
 * Used to check if seller has completed onboarding.
 */
export async function getAccountStatus(accountId: string): Promise<AccountStatusResult> {
  try {
    const account = await stripe.accounts.retrieve(accountId);

    return {
      success: true,
      status: {
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        requiresAction: (account.requirements?.currently_due?.length ?? 0) > 0,
        currentlyDue: account.requirements?.currently_due ?? [],
      },
    };
  } catch (error) {
    logger.error('Failed to get account status', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account status',
    };
  }
}

/**
 * Update seller profile based on Connect account status.
 * Called by webhook handler when account.updated fires.
 */
export async function syncAccountStatus(accountId: string): Promise<void> {
  const statusResult = await getAccountStatus(accountId);
  if (!statusResult.success || !statusResult.status) return;

  const { chargesEnabled, payoutsEnabled, detailsSubmitted } = statusResult.status;

  // stripeOnboarded = true if detailsSubmitted
  // payoutsEnabled = true only if both chargesEnabled AND payoutsEnabled
  await db
    .update(sellerProfile)
    .set({
      stripeOnboarded: detailsSubmitted,
      payoutsEnabled: chargesEnabled && payoutsEnabled,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfile.stripeAccountId, accountId));
}

/**
 * Create a login link for seller to access Stripe Express Dashboard.
 */
export async function createDashboardLink(accountId: string): Promise<OnboardingLinkResult> {
  try {
    const loginLink = await stripe.accounts.createLoginLink(accountId);
    return { success: true, url: loginLink.url };
  } catch (error) {
    logger.error('Failed to create dashboard link', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create dashboard link',
    };
  }
}

/**
 * Delete a Connect account (for testing/cleanup).
 * In production, accounts are typically just deactivated.
 */
export async function deleteConnectAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await stripe.accounts.del(accountId);

    // Clear from seller profile
    await db
      .update(sellerProfile)
      .set({
        stripeAccountId: null,
        stripeOnboarded: false,
        payoutsEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfile.stripeAccountId, accountId));

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete Connect account', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete account',
    };
  }
}

/**
 * Type guard for Stripe Connect webhook events.
 */
export function isConnectWebhookEvent(event: Stripe.Event): boolean {
  // Connect events have an account property
  return 'account' in event && typeof event.account === 'string';
}
