'use server';

/**
 * F6: Purchase Automation Add-On Server Action
 *
 * Creates a Stripe Checkout session for the Automation add-on ($9.99/mo).
 * Gate: seller must have Crosslister LITE or PRO (not FREE or NONE).
 * Source: F6 install prompt §A.1; Lister Canonical Section 17.3.
 */

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@twicely/db';
import { authorize, sub } from '@twicely/casl';
import { sellerProfile, automationSubscription } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { setStripeCustomerId } from '@/lib/mutations/subscriptions';

// ─── Validation ──────────────────────────────────────────────────────────────

const purchaseAutomationSchema = z.object({
  billingCycle: z.enum(['annual', 'monthly']),
}).strict();

type PurchaseAutomationInput = z.infer<typeof purchaseAutomationSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface PurchaseAutomationResult {
  success: boolean;
  url?: string;
  error?: string;
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function purchaseAutomationAction(
  input: PurchaseAutomationInput,
): Promise<PurchaseAutomationResult> {
  // 1. Validate input
  const parsed = purchaseAutomationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const { billingCycle } = parsed.data;

  // 2. authorize() session
  const { ability, session } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // 3. CASL check
  if (!ability.can('manage', sub('AutomationSetting', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // 4. Get sellerProfileId
  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 5. Load seller profile
  const [profile] = await db
    .select({
      hasAutomation: sellerProfile.hasAutomation,
      listerTier: sellerProfile.listerTier,
      stripeCustomerId: sellerProfile.stripeCustomerId,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 6. Validate not already subscribed
  if (profile.hasAutomation) {
    return { success: false, error: 'Already subscribed to Automation.' };
  }

  // 7. Gate: LITE or PRO required (Lister Canonical Section 17.3)
  if (profile.listerTier === 'NONE' || profile.listerTier === 'FREE') {
    return {
      success: false,
      error: 'Automation requires Crosslister Lite or above.',
    };
  }

  // 8. Check for existing active automation subscription
  const [existingSub] = await db
    .select({ status: automationSubscription.status })
    .from(automationSubscription)
    .where(eq(automationSubscription.sellerProfileId, sellerProfileId))
    .limit(1);

  if (existingSub?.status === 'ACTIVE' || existingSub?.status === 'TRIALING') {
    return { success: false, error: 'Already subscribed to Automation.' };
  }

  // 9. Read pricing from platform_settings — never hardcoded
  const priceKey =
    billingCycle === 'annual'
      ? 'automation.pricing.annualCents'
      : 'automation.pricing.monthlyCents';
  const priceCents = await getPlatformSetting<number>(priceKey, billingCycle === 'annual' ? 999 : 1299);

  // 10. Get or create Stripe Customer
  let stripeCustomerId = profile.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      metadata: { sellerProfileId, userId },
    });
    stripeCustomerId = customer.id;
    await setStripeCustomerId(sellerProfileId, stripeCustomerId);
  }

  // 11. Build base URL from request headers
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${protocol}://${host}`;

  // 12. Create Stripe Checkout Session (price in cents from platform_settings)
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'Automation Add-On' },
          unit_amount: priceCents,
          recurring: {
            interval: billingCycle === 'annual' ? 'year' : 'month',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/my/selling/crosslist/automation?success=true`,
    cancel_url: `${baseUrl}/my/selling/crosslist/automation?canceled=true`,
    metadata: {
      product: 'automation',
      sellerProfileId,
      userId,
    },
    subscription_data: {
      metadata: {
        product: 'automation',
        sellerProfileId,
        userId,
      },
    },
  });

  if (!checkoutSession.url) {
    return { success: false, error: 'Failed to create checkout session' };
  }

  return { success: true, url: checkoutSession.url };
}
