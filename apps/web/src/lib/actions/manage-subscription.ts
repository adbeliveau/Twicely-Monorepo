'use server';

/**
 * D3-S3: Subscription Management Actions
 *
 * cancelSubscriptionAction — sets cancel_at_period_end (NOT immediate cancel)
 * createBillingPortalSession — redirects to Stripe hosted portal
 */

import { z } from 'zod';
import { headers } from 'next/headers';
import { authorize, sub } from '@twicely/casl';
import { db } from '@twicely/db';
import { sellerProfile, bundleSubscription } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { getSellerProfileIdByUserId, getStripeSubscriptionId, getProfileTiers } from '@/lib/queries/subscriptions';

// ─── Schemas ────────────────────────────────────────────────────────────────

const CancelSubscriptionSchema = z.object({
  product: z.enum(['store', 'lister', 'automation', 'finance', 'bundle']),
}).strict();

const BillingPortalSchema = z.object({
  returnUrl: z.string().url().optional(),
}).strict();

// ─── Types ──────────────────────────────────────────────────────────────────

interface CancelResult {
  success: boolean;
  error?: string;
}

interface PortalResult {
  success: boolean;
  portalUrl?: string;
  error?: string;
}

// ─── Cancel Subscription ────────────────────────────────────────────────────

/**
 * Cancel a subscription at period end.
 * Calls stripe.subscriptions.update({ cancel_at_period_end: true }).
 * Does NOT call stripe.subscriptions.cancel() — seller keeps access until billing cycle ends.
 */
export async function cancelSubscriptionAction(
  input: z.infer<typeof CancelSubscriptionSchema>
): Promise<CancelResult> {
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Subscription', { sellerId: userId }))) {
    return { success: false, error: 'Insufficient permissions' };
  }

  const parsed = CancelSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const { product } = parsed.data;

  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) {
    return { success: false, error: 'Seller profile not found' };
  }

  // Bundle cancel: query bundleSubscription directly, update DB with cancelAtPeriodEnd + clear pending
  if (product === 'bundle') {
    const [bundleSub] = await db
      .select({ stripeSubscriptionId: bundleSubscription.stripeSubscriptionId })
      .from(bundleSubscription)
      .where(eq(bundleSubscription.sellerProfileId, sellerProfileId))
      .limit(1);
    if (!bundleSub?.stripeSubscriptionId) {
      return { success: false, error: 'No active subscription found' };
    }
    try {
      await stripe.subscriptions.update(bundleSub.stripeSubscriptionId, { cancel_at_period_end: true });
    } catch {
      return { success: false, error: 'Failed to cancel subscription' };
    }
    await db.update(bundleSubscription).set({
      cancelAtPeriodEnd: true, pendingTier: null, pendingBillingInterval: null,
      pendingChangeAt: null, updatedAt: new Date(),
    }).where(eq(bundleSubscription.sellerProfileId, sellerProfileId));
    return { success: true };
  }

  const stripeSubId = await getStripeSubscriptionId(sellerProfileId, product);
  if (!stripeSubId) {
    return { success: false, error: 'No active subscription found' };
  }

  try {
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    });
  } catch {
    return { success: false, error: 'Failed to cancel subscription' };
  }

  return { success: true };
}

// ─── Billing Portal ─────────────────────────────────────────────────────────

/**
 * Create a Stripe Billing Portal session for payment method management.
 * Returns the portal URL for client-side redirect.
 */
export async function createBillingPortalSession(
  input?: z.infer<typeof BillingPortalSchema>
): Promise<PortalResult> {
  const { ability, session: caslSession } = await authorize();
  if (!caslSession) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = caslSession.delegationId ? caslSession.onBehalfOfSellerId! : caslSession.userId;
  if (!ability.can('read', sub('Subscription', { sellerId: userId }))) {
    return { success: false, error: 'Insufficient permissions' };
  }

  const parsed = BillingPortalSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) {
    return { success: false, error: 'Seller profile not found' };
  }

  const [profile] = await db
    .select({ stripeCustomerId: sellerProfile.stripeCustomerId })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile?.stripeCustomerId) {
    return { success: false, error: 'No billing account found' };
  }

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: parsed.data.returnUrl || `${baseUrl}/my/selling/subscription`,
    });

    return { success: true, portalUrl: portalSession.url };
  } catch {
    return { success: false, error: 'Failed to open billing portal' };
  }
}

/** Get the current subscription tiers for the authenticated seller. */
export async function getSellerProfileTierSummaryAction() {
  const { session } = await authorize();
  if (!session) return null;
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  const profileId = await getSellerProfileIdByUserId(userId);
  if (!profileId) return null;
  return getProfileTiers(profileId);
}
