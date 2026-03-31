/**
 * D3-S2: Add-on Subscription Mutations
 *
 * Write operations for automation, finance, and bundle subscription tables.
 * Extracted from subscriptions.ts to keep file size within the 300-line limit.
 * Called by the Stripe webhook handler.
 */

import { db } from '@twicely/db';
import {
  sellerProfile,
  automationSubscription,
  financeSubscription,
  bundleSubscription,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type { FinanceTier, SubscriptionStatus, BundleTier } from '@twicely/db/types';
import { resolveBundleComponents } from './bundle-resolution';

// ─── Automation Subscription ────────────────────────────────────────────────

export async function upsertAutomationSubscription(params: {
  sellerProfileId: string;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: automationSubscription.id })
      .from(automationSubscription)
      .where(eq(automationSubscription.sellerProfileId, params.sellerProfileId))
      .limit(1);

    if (existing) {
      await tx
        .update(automationSubscription)
        .set({
          status: params.status,
          stripeSubscriptionId: params.stripeSubscriptionId,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          cancelAtPeriodEnd: params.cancelAtPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(automationSubscription.id, existing.id));
    } else {
      await tx.insert(automationSubscription).values({
        sellerProfileId: params.sellerProfileId,
        status: params.status,
        stripeSubscriptionId: params.stripeSubscriptionId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      });
    }

    // hasAutomation is true only for active/trialing statuses
    const hasAutomation = params.status === 'ACTIVE' || params.status === 'TRIALING';
    await tx
      .update(sellerProfile)
      .set({ hasAutomation, updatedAt: new Date() })
      .where(eq(sellerProfile.id, params.sellerProfileId));
  });
}

// ─── Finance Subscription ───────────────────────────────────────────────────

export async function upsertFinanceSubscription(params: {
  sellerProfileId: string;
  tier: FinanceTier;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: financeSubscription.id })
      .from(financeSubscription)
      .where(eq(financeSubscription.sellerProfileId, params.sellerProfileId))
      .limit(1);

    if (existing) {
      await tx
        .update(financeSubscription)
        .set({
          tier: params.tier,
          status: params.status,
          stripeSubscriptionId: params.stripeSubscriptionId,
          stripePriceId: params.stripePriceId,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          cancelAtPeriodEnd: params.cancelAtPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(financeSubscription.id, existing.id));
    } else {
      await tx.insert(financeSubscription).values({
        sellerProfileId: params.sellerProfileId,
        tier: params.tier,
        status: params.status,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripePriceId: params.stripePriceId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      });
    }

    await tx
      .update(sellerProfile)
      .set({ financeTier: params.tier, updatedAt: new Date() })
      .where(eq(sellerProfile.id, params.sellerProfileId));
  });
}

// ─── Bundle Subscription ────────────────────────────────────────────────────

export async function upsertBundleSubscription(params: {
  sellerProfileId: string;
  tier: BundleTier;
  status: SubscriptionStatus;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: Date | null;
}): Promise<void> {
  const components = resolveBundleComponents(params.tier);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: bundleSubscription.id })
      .from(bundleSubscription)
      .where(eq(bundleSubscription.sellerProfileId, params.sellerProfileId))
      .limit(1);

    if (existing) {
      await tx.update(bundleSubscription).set({
        tier: params.tier,
        status: params.status,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripePriceId: params.stripePriceId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
        updatedAt: new Date(),
      }).where(eq(bundleSubscription.id, existing.id));
    } else {
      await tx.insert(bundleSubscription).values({
        sellerProfileId: params.sellerProfileId,
        tier: params.tier,
        status: params.status,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripePriceId: params.stripePriceId,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      });
    }

    // Update sellerProfile with bundle tier + resolved component tiers
    await tx.update(sellerProfile).set({
      bundleTier: params.tier,
      storeTier: components.storeTier,
      listerTier: components.listerTier,
      financeTier: components.financeTier,
      hasAutomation: components.hasAutomation,
      updatedAt: new Date(),
    }).where(eq(sellerProfile.id, params.sellerProfileId));
  });
}
