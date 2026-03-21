'use server';

/**
 * F6: Cancel Automation Add-On Server Action
 *
 * Cancels the seller's Automation add-on subscription via Stripe.
 * Source: F6 install prompt §A.2.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { authorize, sub } from '@twicely/casl';
import { sellerProfile, automationSubscription } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { cancelSubscription } from '@/lib/mutations/subscriptions';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';

// ─── Validation ──────────────────────────────────────────────────────────────

const cancelAutomationSchema = z.object({}).strict();

// ─── Types ───────────────────────────────────────────────────────────────────

interface CancelAutomationResult {
  success: boolean;
  error?: string;
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function cancelAutomationAction(): Promise<CancelAutomationResult> {
  // 1. Validate input (no params — seller cancels their own)
  cancelAutomationSchema.parse({});

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

  // 5. Validate hasAutomation === true
  const [profile] = await db
    .select({ hasAutomation: sellerProfile.hasAutomation })
    .from(sellerProfile)
    .where(eq(sellerProfile.id, sellerProfileId))
    .limit(1);

  if (!profile?.hasAutomation) {
    return { success: false, error: 'No active Automation subscription found.' };
  }

  // 6. Get stripe subscription ID
  const [autoSub] = await db
    .select({ stripeSubscriptionId: automationSubscription.stripeSubscriptionId })
    .from(automationSubscription)
    .where(eq(automationSubscription.sellerProfileId, sellerProfileId))
    .limit(1);

  if (!autoSub?.stripeSubscriptionId) {
    return { success: false, error: 'Automation subscription record not found.' };
  }

  // 7. Cancel via existing cancelSubscription mutation
  await cancelSubscription({
    product: 'automation',
    sellerProfileId,
    stripeSubscriptionId: autoSub.stripeSubscriptionId,
  });

  // 8. Revalidate paths
  revalidatePath('/my/selling/subscription');
  revalidatePath('/my/selling/crosslist/automation');

  return { success: true };
}
