'use server';

/**
 * D3-S5: Create Bundle Checkout Session
 *
 * Creates a Stripe Checkout Session for bundle subscription purchases.
 * Cancels any existing individual subscriptions immediately (with proration credit).
 * Does NOT update sellerProfile tier columns — the webhook handles that.
 */

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@twicely/db';
import {
  sellerProfile,
  storeSubscription,
  listerSubscription,
  automationSubscription,
  financeSubscription,
  bundleSubscription,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { stripe } from '@twicely/stripe/server';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import { setStripeCustomerId } from '@/lib/mutations/subscriptions';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateBundleCheckoutSchema = z.object({
  bundleTier: z.enum(['STARTER', 'PRO', 'POWER']),
  billingInterval: z.enum(['monthly', 'annual']),
}).strict();

// ─── Types ──────────────────────────────────────────────────────────────────

interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function createBundleCheckout(
  input: z.infer<typeof CreateBundleCheckoutSchema>
): Promise<CheckoutResult> {
  // 0. Validate input
  const parsed = CreateBundleCheckoutSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { bundleTier, billingInterval } = parsed.data;

  // 1. Auth + CASL + Delegation
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('create', sub('Subscription', { sellerId: userId }))) {
    return { success: false, error: 'Insufficient permissions' };
  }

  // Resolve sellerProfile.id — subscription tables FK to sellerProfile, not user
  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) return { success: false, error: 'Seller profile not found' };

  // 2. Load seller profile
  const [profile] = await db
    .select({
      sellerType: sellerProfile.sellerType,
      stripeCustomerId: sellerProfile.stripeCustomerId,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile) return { success: false, error: 'Seller profile not found' };

  // 3. PERSONAL seller guard — bundles include Store, Store requires BUSINESS
  if (profile.sellerType === 'PERSONAL') {
    return { success: false, error: 'Bundles require a Business seller account' };
  }

  // 4. Check for existing active bundle
  const [existingBundle] = await db
    .select({ status: bundleSubscription.status })
    .from(bundleSubscription)
    .where(eq(bundleSubscription.sellerProfileId, sellerProfileId))
    .limit(1);

  if (existingBundle?.status === 'ACTIVE' || existingBundle?.status === 'TRIALING') {
    return { success: false, error: 'Already on a bundle. Use Change Plan to switch bundles.' };
  }

  // 5. Cancel existing individual subscriptions immediately
  await cancelExistingIndividualSubs(sellerProfileId);

  // 6. Get Stripe Price ID for bundle
  const stripePriceId = getStripePriceId('bundle', bundleTier, billingInterval);
  if (!stripePriceId) return { success: false, error: 'Invalid bundle/tier combination' };

  // 7. Get or create Stripe Customer
  let stripeCustomerId = profile.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      metadata: { sellerProfileId, userId },
    });
    stripeCustomerId = customer.id;
    await setStripeCustomerId(sellerProfileId, stripeCustomerId);
  }

  // 8. Build base URL from request headers
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  // 9. Create Stripe Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/my/selling/subscription?bundleSuccess=true`,
    cancel_url: `${baseUrl}/my/selling/subscription`,
    metadata: {
      sellerProfileId,
      product: 'bundle',
      tier: bundleTier,
    },
    subscription_data: {
      metadata: {
        sellerProfileId,
        product: 'bundle',
        tier: bundleTier,
      },
    },
  });

  if (!checkoutSession.url) {
    return { success: false, error: 'Failed to create checkout session' };
  }

  return { success: true, checkoutUrl: checkoutSession.url };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Cancel all existing individual subscriptions immediately with proration credit.
 * Updates subscription rows only — does NOT touch sellerProfile tier columns
 * (the bundle webhook handles tier updates).
 */
async function cancelExistingIndividualSubs(sellerProfileId: string): Promise<void> {
  const now = new Date();

  // Fetch all 4 subscription types in parallel
  const [storeSubs, listerSubs, autoSubs, financeSubs] = await Promise.all([
    db.select({
      stripeSubscriptionId: storeSubscription.stripeSubscriptionId,
      status: storeSubscription.status,
    }).from(storeSubscription)
      .where(eq(storeSubscription.sellerProfileId, sellerProfileId)).limit(1),
    db.select({
      stripeSubscriptionId: listerSubscription.stripeSubscriptionId,
      status: listerSubscription.status,
    }).from(listerSubscription)
      .where(eq(listerSubscription.sellerProfileId, sellerProfileId)).limit(1),
    db.select({
      stripeSubscriptionId: automationSubscription.stripeSubscriptionId,
      status: automationSubscription.status,
    }).from(automationSubscription)
      .where(eq(automationSubscription.sellerProfileId, sellerProfileId)).limit(1),
    db.select({
      stripeSubscriptionId: financeSubscription.stripeSubscriptionId,
      status: financeSubscription.status,
    }).from(financeSubscription)
      .where(eq(financeSubscription.sellerProfileId, sellerProfileId)).limit(1),
  ]);

  const subsToCancel: Array<{
    stripeSubId: string;
    table: typeof storeSubscription | typeof listerSubscription
      | typeof automationSubscription | typeof financeSubscription;
    hasCancel: boolean;
  }> = [];

  const checkAndAdd = (
    rows: Array<{ stripeSubscriptionId: string | null; status: string }>,
    table: typeof storeSubscription | typeof listerSubscription
      | typeof automationSubscription | typeof financeSubscription,
    hasCanceledAt: boolean,
  ) => {
    const row = rows[0];
    if (row?.stripeSubscriptionId && (row.status === 'ACTIVE' || row.status === 'TRIALING')) {
      subsToCancel.push({ stripeSubId: row.stripeSubscriptionId, table, hasCancel: hasCanceledAt });
    }
  };

  checkAndAdd(storeSubs, storeSubscription, true);
  checkAndAdd(listerSubs, listerSubscription, true);
  checkAndAdd(autoSubs, automationSubscription, false);
  checkAndAdd(financeSubs, financeSubscription, true);

  // Cancel each in Stripe and update DB row
  for (const { stripeSubId, table, hasCancel } of subsToCancel) {
    await stripe.subscriptions.cancel(stripeSubId);
    const updateFields: Record<string, unknown> = { status: 'CANCELED', updatedAt: now };
    if (hasCancel) {
      updateFields.canceledAt = now;
    }
    await db.update(table)
      .set(updateFields)
      .where(eq(table.stripeSubscriptionId, stripeSubId));
  }
}
