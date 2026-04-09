'use server';

import { db } from '@twicely/db';
import { sellerProfile, user } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  createConnectAccount,
  createOnboardingLink,
  getAccountStatus,
  createDashboardLink,
  syncAccountStatus,
} from '@twicely/stripe/connect';
import { getSellerStripeAccountId, isSellerPaymentReady, getSellerStoreTier } from '@/lib/queries/stripe-seller';

interface OnboardingResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface AccountStatusResult {
  success: boolean;
  status?: {
    stripeAccountId: string | null;
    stripeOnboarded: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    requiresAction: boolean;
    currentlyDue: string[];
  };
  error?: string;
}

/**
 * Start or continue Stripe Connect onboarding for the current seller.
 * Creates account if needed, returns onboarding URL.
 */
export async function startOnboardingAction(): Promise<OnboardingResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('manage', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Get seller's existing Stripe account ID (if any)
  let accountId = await getSellerStripeAccountId(userId);

  const [userData] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData?.email) {
    return { success: false, error: 'User email not found' };
  }
  if (!accountId) {
    const createResult = await createConnectAccount(userId, userData.email);
    if (!createResult.success || !createResult.accountId) {
      return { success: false, error: createResult.error ?? 'Failed to create Stripe account' };
    }
    accountId = createResult.accountId;
  }

  // Create onboarding link
  const linkResult = await createOnboardingLink(accountId);
  if (!linkResult.success || !linkResult.url) {
    return { success: false, error: linkResult.error ?? 'Failed to create onboarding link' };
  }

  return { success: true, url: linkResult.url };
}

/**
 * Get current Stripe Connect status for the seller.
 */
export async function getOnboardingStatusAction(): Promise<AccountStatusResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Get seller profile
  const [profile] = await db
    .select({
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
      payoutsEnabled: sellerProfile.payoutsEnabled,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }

  // If no Stripe account yet, return defaults
  if (!profile.stripeAccountId) {
    return {
      success: true,
      status: {
        stripeAccountId: null,
        stripeOnboarded: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        requiresAction: true,
        currentlyDue: [],
      },
    };
  }

  // Get status from Stripe
  const stripeStatus = await getAccountStatus(profile.stripeAccountId);
  if (!stripeStatus.success || !stripeStatus.status) {
    return {
      success: true,
      status: {
        stripeAccountId: profile.stripeAccountId,
        stripeOnboarded: profile.stripeOnboarded,
        payoutsEnabled: profile.payoutsEnabled,
        chargesEnabled: false,
        detailsSubmitted: false,
        requiresAction: true,
        currentlyDue: [],
      },
    };
  }

  // Write fresh Stripe status back to DB so downstream reads (seller profile,
  // payout request, onboarding page initialStep) see the current state instead
  // of waiting for the account.updated webhook.
  const freshStripeOnboarded = stripeStatus.status.detailsSubmitted;
  const freshPayoutsEnabled =
    stripeStatus.status.chargesEnabled && stripeStatus.status.payoutsEnabled;
  if (
    freshStripeOnboarded !== profile.stripeOnboarded ||
    freshPayoutsEnabled !== profile.payoutsEnabled
  ) {
    try {
      await syncAccountStatus(profile.stripeAccountId);
    } catch {
      // Non-fatal: the return value below still reflects the fresh Stripe state.
    }
  }

  return {
    success: true,
    status: {
      stripeAccountId: profile.stripeAccountId,
      stripeOnboarded: freshStripeOnboarded,
      payoutsEnabled: freshPayoutsEnabled,
      chargesEnabled: stripeStatus.status.chargesEnabled,
      detailsSubmitted: stripeStatus.status.detailsSubmitted,
      requiresAction: stripeStatus.status.requiresAction,
      currentlyDue: stripeStatus.status.currentlyDue,
    },
  };
}

/**
 * Get a link to the Stripe Express Dashboard for the seller.
 */
export async function getStripeDashboardLinkAction(): Promise<OnboardingResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // Get seller profile
  const [profile] = await db
    .select({ stripeAccountId: sellerProfile.stripeAccountId })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.stripeAccountId) {
    return { success: false, error: 'Stripe account not connected' };
  }

  const result = await createDashboardLink(profile.stripeAccountId);
  if (!result.success || !result.url) {
    return { success: false, error: result.error ?? 'Failed to create dashboard link' };
  }

  return { success: true, url: result.url };
}

/** Check if a seller has payment capability (Stripe Connect fully onboarded). */
export async function checkSellerPaymentReadyAction(): Promise<{ ready: boolean }> {
  const { session } = await authorize();
  if (!session) return { ready: false };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  const ready = await isSellerPaymentReady(userId);
  return { ready };
}

/** Get the store tier for the current seller (for tier-gated feature checks). */
export async function getSellerStoreTierAction(): Promise<{ tier: string | null }> {
  const { session } = await authorize();
  if (!session) return { tier: null };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  const tier = await getSellerStoreTier(userId);
  return { tier };
}
