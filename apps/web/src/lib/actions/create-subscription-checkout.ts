'use server';

/**
 * D3-S2: Create Subscription Checkout Session
 *
 * Server action that creates a Stripe Checkout Session for subscription purchases.
 * Does NOT handle bundles or upgrade/downgrade (those are D3-S4/S5).
 */

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@twicely/db';
import { authorize, sub } from '@twicely/casl';
import {
  identityVerification,
  sellerProfile,
  storeSubscription,
  listerSubscription,
  automationSubscription,
  financeSubscription,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import { canSubscribeToStoreTier, isPaidStoreTier, isPaidListerTier } from '@twicely/subscriptions/subscription-engine';
import { setStripeCustomerId } from '@/lib/mutations/subscriptions';
import type { SubscriptionProduct } from '@twicely/subscriptions/price-map';
import type { StoreTier } from '@/types/enums';

// ─── Validation ─────────────────────────────────────────────────────────────

const CreateCheckoutSchema = z.object({
  product: z.enum(['store', 'lister', 'automation', 'finance']),
  tier: z.string().min(1).max(20),
  interval: z.enum(['monthly', 'annual']),
  promoCode: z.string().min(1).max(20).optional(),
}).strict();

// ─── Types ──────────────────────────────────────────────────────────────────

type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;
type ProductEnum = 'store' | 'lister' | 'automation' | 'finance';

interface CheckoutResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function createSubscriptionCheckout(
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  // 0. Auth via CASL
  const { ability, session: caslSession } = await authorize();
  if (!caslSession) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = caslSession.delegationId ? caslSession.onBehalfOfSellerId! : caslSession.userId;
  const sessionSellerId = caslSession.sellerId;
  if (!sessionSellerId || !ability.can('create', sub('Subscription', { sellerId: sessionSellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // 1. Validate input
  const parsed = CreateCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const { product, tier, interval, promoCode: promoCodeInput } = parsed.data;

  // 2. Get sellerProfileId
  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 3. Load seller profile for eligibility checks
  const [profile] = await db
    .select({
      sellerType: sellerProfile.sellerType,
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
      stripeCustomerId: sellerProfile.stripeCustomerId,
      storeTier: sellerProfile.storeTier,
      listerTier: sellerProfile.listerTier,
      financeTier: sellerProfile.financeTier,
      hasAutomation: sellerProfile.hasAutomation,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 4. Eligibility check (store only)
  if (product === 'store') {
    // H3 Security: Query actual identity verification status
    const [idvRow] = await db
      .select({ status: identityVerification.status })
      .from(identityVerification)
      .where(eq(identityVerification.userId, userId))
      .limit(1);

    const eligibility = canSubscribeToStoreTier(tier as StoreTier, {
      isBusinessSeller: profile.sellerType === 'BUSINESS',
      hasStripeConnect: !!profile.stripeAccountId && profile.stripeOnboarded,
      hasIdentityVerified: idvRow?.status === 'VERIFIED',
    });
    if (!eligibility.allowed) {
      return { success: false, error: eligibility.reason };
    }
  }

  // 5. Validate tier is paid (not NONE/FREE)
  if (product === 'store' && !isPaidStoreTier(tier as StoreTier)) {
    return { success: false, error: 'Invalid tier for subscription' };
  }
  if (product === 'lister') {
    const listerTier = tier as 'NONE' | 'FREE' | 'LITE' | 'PRO';
    if (!isPaidListerTier(listerTier)) {
      return { success: false, error: 'Invalid tier for subscription' };
    }
  }

  // 6. Get Stripe Price ID
  const stripePriceId = getStripePriceId(product, tier, interval);
  if (!stripePriceId) {
    return { success: false, error: 'Invalid product/tier combination' };
  }

  // 7. Check for existing active subscription (upgrade is D3-S4)
  const hasActiveSubscription = await checkActiveSubscription(product, sellerProfileId);
  if (hasActiveSubscription) {
    return {
      success: false,
      error: 'Already subscribed. Use upgrade/downgrade instead.',
    };
  }

  // 8. Get or create Stripe Customer
  let stripeCustomerId = profile.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: caslSession.email,
      metadata: {
        sellerProfileId,
        userId,
      },
    });
    stripeCustomerId = customer.id;
    await setStripeCustomerId(sellerProfileId, stripeCustomerId);
  }

  // 9. Validate and resolve promo code
  let stripePromotionCodeId: string | undefined;
  let validatedPromoCodeId: string | undefined;
  let promoDiscountCents = 0;
  let promoDurationMonths = 0;

  if (promoCodeInput) {
    // Dynamic imports avoid transitive drizzle-orm/sql import in tests
    const { validatePromoCode } = await import('@/lib/actions/promo-codes-platform');
    const { getPromoCodeByCode } = await import('@/lib/queries/promo-codes');

    const validation = await validatePromoCode({ code: promoCodeInput, product });
    if (!validation.valid) {
      return { success: false, error: validation.error ?? 'Invalid promo code' };
    }
    // Look up Stripe PromotionCode ID
    const stripeList = await stripe.promotionCodes.list({ code: promoCodeInput.toUpperCase(), limit: 1 });
    const stripePromo = stripeList.data[0];
    if (stripePromo?.active) {
      stripePromotionCodeId = stripePromo.id;
    }
    const promoRecord = await getPromoCodeByCode(promoCodeInput.toUpperCase());
    if (promoRecord) {
      validatedPromoCodeId = promoRecord.id;
      promoDiscountCents = promoRecord.discountValue;
      promoDurationMonths = promoRecord.durationMonths;
    }
  }

  // 10. Build base URL from request headers
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = headersList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  // 11. Create Stripe Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/my/selling/subscription?success=true&product=${product}`,
    cancel_url: `${baseUrl}/my/selling/subscription?canceled=true`,
    metadata: {
      sellerProfileId,
      product,
      tier,
    },
    subscription_data: {
      metadata: {
        sellerProfileId,
        product,
        tier,
      },
    },
    ...(stripePromotionCodeId
      ? { discounts: [{ promotion_code: stripePromotionCodeId }] }
      : {}),
  });

  if (!checkoutSession.url) {
    return { success: false, error: 'Failed to create checkout session' };
  }

  // 12. Record promo code redemption
  if (validatedPromoCodeId && stripePromotionCodeId) {
    const { recordPromoCodeRedemption } = await import('@/lib/actions/promo-codes-helpers');
    await recordPromoCodeRedemption(
      validatedPromoCodeId,
      userId,
      product as ProductEnum,
      promoDiscountCents,
      promoDurationMonths,
      stripePromotionCodeId,
    );
  }

  return { success: true, checkoutUrl: checkoutSession.url };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if seller already has an active subscription for this product.
 * Active means status is ACTIVE or TRIALING.
 */
async function checkActiveSubscription(
  product: Exclude<SubscriptionProduct, 'bundle'>,
  sellerProfileId: string
): Promise<boolean> {
  switch (product) {
    case 'store': {
      const [row] = await db
        .select({ status: storeSubscription.status })
        .from(storeSubscription)
        .where(eq(storeSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      return row?.status === 'ACTIVE' || row?.status === 'TRIALING';
    }
    case 'lister': {
      const [row] = await db
        .select({ status: listerSubscription.status })
        .from(listerSubscription)
        .where(eq(listerSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      return row?.status === 'ACTIVE' || row?.status === 'TRIALING';
    }
    case 'automation': {
      const [row] = await db
        .select({ status: automationSubscription.status })
        .from(automationSubscription)
        .where(eq(automationSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      return row?.status === 'ACTIVE' || row?.status === 'TRIALING';
    }
    case 'finance': {
      const [row] = await db
        .select({ status: financeSubscription.status })
        .from(financeSubscription)
        .where(eq(financeSubscription.sellerProfileId, sellerProfileId))
        .limit(1);
      return row?.status === 'ACTIVE' || row?.status === 'TRIALING';
    }
  }
}
