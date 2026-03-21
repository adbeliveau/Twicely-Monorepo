'use server';

/**
 * D3-S4: Change Subscription (Upgrade / Downgrade / Interval Change)
 *
 * UPGRADE / INTERVAL_UPGRADE: Stripe update immediately with create_prorations.
 * DOWNGRADE / INTERVAL_DOWNGRADE: Store pending in DB, apply at renewal via webhook.
 *
 * Both paths use SELECT ... FOR UPDATE to prevent concurrent mutations.
 */

import { z } from 'zod';
import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import {
  storeSubscription,
  listerSubscription,
  financeSubscription,
  bundleSubscription,
} from '@/lib/db/schema/subscriptions';
import { eq } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { authorize, sub } from '@twicely/casl';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import {
  classifySubscriptionChange,
  getBillingIntervalFromPriceId,
} from '@twicely/subscriptions/subscription-engine';
import type { ChangeClassification } from '@twicely/subscriptions/subscription-engine';
import { resolveBundleComponents } from '@twicely/subscriptions/bundle-resolution';
import type { StoreTier, ListerTier, FinanceTier, BundleTier } from '@/types/enums';

// ─── Schemas ────────────────────────────────────────────────────────────────

const ChangeSubscriptionSchema = z.object({
  product: z.enum(['store', 'lister', 'finance', 'bundle']),
  targetTier: z.enum(['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE', 'FREE', 'LITE']),
  targetInterval: z.enum(['monthly', 'annual']),
}).strict();

const CancelPendingSchema = z.object({
  product: z.enum(['store', 'lister', 'finance', 'bundle']),
}).strict();

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChangeResult {
  success: boolean;
  error?: string;
  classification?: ChangeClassification;
  effectiveDate?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSubscriptionTable(product: 'store' | 'lister' | 'finance' | 'bundle') {
  switch (product) {
    case 'store': return storeSubscription;
    case 'lister': return listerSubscription;
    case 'finance': return financeSubscription;
    case 'bundle': return bundleSubscription;
  }
}

const VALID_TIERS: Record<string, string[]> = {
  store: ['STARTER', 'PRO', 'POWER'],
  lister: ['FREE', 'LITE', 'PRO'],
  finance: ['FREE', 'PRO'],
  bundle: ['STARTER', 'PRO', 'POWER'],
};

// ─── Change Subscription ────────────────────────────────────────────────────

export async function changeSubscriptionAction(
  input: z.infer<typeof ChangeSubscriptionSchema>
): Promise<ChangeResult> {
  const parsed = ChangeSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { product, targetTier, targetInterval } = parsed.data;

  if (!VALID_TIERS[product]?.includes(targetTier)) {
    return { success: false, error: 'Invalid tier for this product' };
  }

  // 1. Auth + CASL
  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Subscription', { sellerId: userId }))) {
    return { success: false, error: 'Insufficient permissions' };
  }

  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) return { success: false, error: 'Seller profile not found' };

  // 2. Transaction with FOR UPDATE to prevent concurrent mutations
  const table = getSubscriptionTable(product);

  return db.transaction(async (tx) => {
    const [currentSub] = await tx
      .select({
        id: table.id,
        tier: table.tier,
        stripePriceId: table.stripePriceId,
        stripeSubscriptionId: table.stripeSubscriptionId,
        currentPeriodEnd: table.currentPeriodEnd,
      })
      .from(table)
      .where(eq(table.sellerProfileId, sellerProfileId))
      .for('update')
      .limit(1);

    if (!currentSub?.stripeSubscriptionId || !currentSub.stripePriceId) {
      return { success: false, error: 'No active subscription found' };
    }

    const currentInterval = getBillingIntervalFromPriceId(currentSub.stripePriceId);
    if (!currentInterval) {
      return { success: false, error: 'Could not determine current billing interval' };
    }

    const classification = classifySubscriptionChange({
      product,
      currentTier: currentSub.tier,
      currentInterval,
      targetTier,
      targetInterval,
    });

    if (classification === 'NO_CHANGE') return { success: false, error: "You're already on this plan" };
    if (classification === 'BLOCKED') return { success: false, error: 'Contact sales for Enterprise changes' };

    if (product === 'store' || product === 'bundle') {
      const [prof] = await tx
        .select({ sellerType: sellerProfile.sellerType })
        .from(sellerProfile)
        .where(eq(sellerProfile.id, sellerProfileId))
        .limit(1);
      if (prof?.sellerType === 'PERSONAL') {
        return { success: false, error: 'Upgrade to Business first' };
      }
    }

    // UPGRADE / INTERVAL_UPGRADE — immediate Stripe update
    if (classification === 'UPGRADE' || classification === 'INTERVAL_UPGRADE') {
      const newPriceId = getStripePriceId(product, targetTier, targetInterval);
      if (!newPriceId) return { success: false, error: 'Invalid target plan' };

      try {
        const stripeSub = await stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);
        const itemId = stripeSub.items.data[0]?.id;
        if (!itemId) return { success: false, error: 'Subscription item not found' };

        await stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
          items: [{ id: itemId, price: newPriceId }],
          proration_behavior: 'create_prorations',
        });
      } catch {
        return { success: false, error: 'Failed to update subscription' };
      }

      const now = new Date();
      await tx.update(table).set({
        tier: targetTier,
        stripePriceId: newPriceId,
        pendingTier: null,
        pendingBillingInterval: null,
        pendingChangeAt: null,
        updatedAt: now,
      }).where(eq(table.id, currentSub.id));

      // Update denormalized tier on sellerProfile so CASL gates reflect immediately
      switch (product) {
        case 'store':
          await tx.update(sellerProfile).set({ storeTier: targetTier as StoreTier, updatedAt: now })
            .where(eq(sellerProfile.id, sellerProfileId));
          break;
        case 'lister':
          await tx.update(sellerProfile).set({ listerTier: targetTier as ListerTier, updatedAt: now })
            .where(eq(sellerProfile.id, sellerProfileId));
          break;
        case 'finance':
          await tx.update(sellerProfile).set({ financeTier: targetTier as FinanceTier, updatedAt: now })
            .where(eq(sellerProfile.id, sellerProfileId));
          break;
        case 'bundle': {
          const components = resolveBundleComponents(targetTier as BundleTier);
          await tx.update(sellerProfile).set({
            bundleTier: targetTier as BundleTier, storeTier: components.storeTier,
            listerTier: components.listerTier, financeTier: components.financeTier,
            hasAutomation: components.hasAutomation, updatedAt: now,
          }).where(eq(sellerProfile.id, sellerProfileId));
          break;
        }
      }

      return { success: true, classification, effectiveDate: 'now' };
    }

    // DOWNGRADE / INTERVAL_DOWNGRADE — store pending, apply at renewal
    if (classification === 'DOWNGRADE') {
      await tx.update(table).set({
        pendingTier: targetTier,
        pendingBillingInterval: targetInterval !== currentInterval ? targetInterval : null,
        pendingChangeAt: currentSub.currentPeriodEnd,
        updatedAt: new Date(),
      }).where(eq(table.id, currentSub.id));
    } else {
      await tx.update(table).set({
        pendingBillingInterval: targetInterval,
        pendingChangeAt: currentSub.currentPeriodEnd,
        updatedAt: new Date(),
      }).where(eq(table.id, currentSub.id));
    }

    return {
      success: true,
      classification,
      effectiveDate: currentSub.currentPeriodEnd?.toISOString() ?? 'end of period',
    };
  });
}

// ─── Cancel Pending Change ──────────────────────────────────────────────────

export async function cancelPendingChangeAction(
  input: z.infer<typeof CancelPendingSchema>
): Promise<{ success: boolean; error?: string }> {
  const parsed = CancelPendingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };
  const { product } = parsed.data;

  const { ability, session } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('Subscription', { sellerId: userId }))) {
    return { success: false, error: 'Insufficient permissions' };
  }

  const sellerProfileId = await getSellerProfileIdByUserId(userId);
  if (!sellerProfileId) return { success: false, error: 'Seller profile not found' };

  const table = getSubscriptionTable(product);
  const [currentSub] = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.sellerProfileId, sellerProfileId))
    .limit(1);

  if (!currentSub) return { success: false, error: 'No subscription found' };

  await db.update(table).set({
    pendingTier: null,
    pendingBillingInterval: null,
    pendingChangeAt: null,
    updatedAt: new Date(),
  }).where(eq(table.id, currentSub.id));

  return { success: true };
}
