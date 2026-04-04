'use server';

/**
 * F4-S3: Purchase Overage Pack Server Action
 *
 * Creates a Stripe Checkout Session (mode: payment) for purchasing
 * +500 publish credits ($9). Credits are delivered via webhook on success.
 * Only LITE and PRO lister tier sellers may purchase overage packs.
 */

import { z } from 'zod';
import { headers } from 'next/headers';
import { db } from '@twicely/db';
import { authorize, sub } from '@twicely/casl';
import { sellerProfile, platformSetting } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { setStripeCustomerId } from '@/lib/mutations/subscriptions';
import { logger } from '@twicely/logger';

// ─── Validation ─────────────────────────────────────────────────────────────

const PurchaseOverageSchema = z.object({
  packType: z.enum(['publishes']),
}).strict();

type PurchaseOverageInput = z.infer<typeof PurchaseOverageSchema>;

// ─── Types ──────────────────────────────────────────────────────────────────

interface PurchaseOverageResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getNumericSetting(key: string, fallback: number): Promise<number> {
  const [row] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, key))
    .limit(1);
  if (!row) return fallback;
  const val = Number(row.value);
  return isFinite(val) && val > 0 ? Math.floor(val) : fallback;
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function purchaseOveragePack(
  input: PurchaseOverageInput
): Promise<PurchaseOverageResult> {
  // 1. Auth via CASL
  const { ability, session: caslSession } = await authorize();
  if (!caslSession) {
    return { success: false, error: 'Unauthorized' };
  }
  const userId = caslSession.delegationId
    ? caslSession.onBehalfOfSellerId!
    : caslSession.userId;

  if (!ability.can('create', sub('Subscription', { sellerId: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  // 2. Validate input
  const parsed = PurchaseOverageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  // 3. Get sellerProfileId
  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 4. Load seller profile — check listerTier
  const [profile] = await db
    .select({
      listerTier: sellerProfile.listerTier,
      stripeCustomerId: sellerProfile.stripeCustomerId,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile) {
    return { success: false, error: 'Seller profile not found' };
  }

  // 5. Gate: only LITE and PRO may purchase overage packs
  if (profile.listerTier !== 'LITE' && profile.listerTier !== 'PRO') {
    return {
      success: false,
      error: 'Overage packs require an active LITE or PRO Crosslister subscription',
    };
  }

  // 6. Read overage price and quantity from platform_settings
  const [priceCents, quantity] = await Promise.all([
    getNumericSetting('overage.publishes.cents', 900),
    getNumericSetting('overage.publishes.qty', 500),
  ]);

  // 7. Get or create Stripe customer
  let stripeCustomerId = profile.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: caslSession.email,
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

  // 9. Create Stripe Checkout Session (one-time payment, NOT subscription)
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: priceCents,
            product_data: {
              name: `Publish Credits (+${quantity})`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'overage_pack',
        packType: 'publishes',
        userId,
        quantity: quantity.toString(),
      },
      success_url: `${baseUrl}/my/selling/crosslist?overage=success`,
      cancel_url: `${baseUrl}/my/selling/crosslist`,
    });

    if (!session.url) {
      return { success: false, error: 'Failed to create checkout session' };
    }

    return { success: true, checkoutUrl: session.url };
  } catch (err) {
    logger.error('[purchase-overage-pack] Failed to create Stripe checkout', { error: err });
    return { success: false, error: 'Failed to create checkout' };
  }
}
