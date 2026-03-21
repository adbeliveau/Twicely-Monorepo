'use server';

import { db } from '@twicely/db';
import { sellerProfile } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { z } from 'zod';
import { checkThresholdStatus } from '@/lib/tax/threshold-tracker';

const getPayoutsSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  cursor: z.string().optional(),
}).strict();

const updateScheduleSchema = z.object({
  interval: z.enum(['manual', 'daily', 'weekly', 'monthly']),
  options: z.object({
    weeklyAnchor: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).optional(),
  }).strict().optional(),
}).strict();
import {
  getSellerBalance,
  getPayoutHistory,
  getPayoutSchedule,
  updatePayoutSchedule,
  type BalanceResult,
  type PayoutHistoryResult,
} from '@twicely/stripe/payouts';

// v3.2: StoreTier simplified to 5 values
type StoreTier = 'NONE' | 'STARTER' | 'PRO' | 'POWER' | 'ENTERPRISE';
type PayoutInterval = 'manual' | 'daily' | 'weekly' | 'monthly';

/** Tier-to-payout-interval mapping per Feature Lock-in §5. */
const TIER_PAYOUT_OPTIONS: Record<StoreTier, PayoutInterval[]> = {
  NONE: ['manual'],
  STARTER: ['manual', 'weekly'],
  PRO: ['manual', 'weekly'],
  POWER: ['manual', 'weekly', 'daily'],
  ENTERPRISE: ['manual', 'weekly', 'daily', 'monthly'],
};

interface GetBalanceResult extends BalanceResult {
  stripeAccountId?: string;
}

type GetPayoutsResult = PayoutHistoryResult;

interface UpdateScheduleResult {
  success: boolean;
  error?: string;
}

interface PayoutOptionsResult {
  success: boolean;
  options?: PayoutInterval[];
  currentSchedule?: {
    interval: PayoutInterval;
    delayDays: number;
    weeklyAnchor?: string;
  };
  error?: string;
}

/**
 * Get seller's Stripe balance.
 */
export async function getBalanceAction(): Promise<GetBalanceResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Payout', { userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const [profile] = await db
    .select({
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.stripeAccountId || !profile.stripeOnboarded) {
    return { success: false, error: 'Stripe account not connected' };
  }

  const result = await getSellerBalance(profile.stripeAccountId);
  return { ...result, isStripeConnected: true } as typeof result & { isStripeConnected: boolean };
}

/**
 * Get seller's payout history (paginated).
 */
export async function getPayoutsAction(
  limit: number = 10,
  cursor?: string
): Promise<GetPayoutsResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }

  const parsed = getPayoutsSchema.safeParse({ limit, cursor });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Payout', { userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const [profile] = await db
    .select({
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.stripeAccountId || !profile.stripeOnboarded) {
    return { success: false, error: 'Stripe account not connected' };
  }

  return getPayoutHistory(profile.stripeAccountId, parsed.data.limit, parsed.data.cursor);
}

/**
 * Get available payout schedule options for seller based on their store tier.
 */
export async function getPayoutOptionsAction(): Promise<PayoutOptionsResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Payout', { userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const [profile] = await db
    .select({
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
      storeTier: sellerProfile.storeTier,
      sellerType: sellerProfile.sellerType,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.stripeAccountId || !profile.stripeOnboarded) {
    return { success: false, error: 'Stripe account not connected' };
  }

  // PERSONAL sellers: manual only, regardless of store tier (Spec §5.1, Decision #86)
  const tier = (profile.storeTier ?? 'NONE') as StoreTier;
  const options = profile.sellerType === 'PERSONAL'
    ? ['manual'] as PayoutInterval[]
    : (TIER_PAYOUT_OPTIONS[tier] ?? TIER_PAYOUT_OPTIONS.NONE);

  const scheduleResult = await getPayoutSchedule(profile.stripeAccountId);

  return {
    success: true,
    options,
    currentSchedule: scheduleResult.success && scheduleResult.schedule
      ? {
          interval: scheduleResult.schedule.interval as PayoutInterval,
          delayDays: scheduleResult.schedule.delayDays,
          weeklyAnchor: scheduleResult.schedule.weeklyAnchor,
        }
      : undefined,
  };
}

/**
 * Update seller's payout schedule.
 * Validates that the requested interval is allowed for their store tier.
 */
export async function updatePayoutScheduleAction(
  interval: PayoutInterval,
  options?: {
    weeklyAnchor?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  }
): Promise<UpdateScheduleResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, error: 'Please sign in to continue' };
  }

  const parsed = updateScheduleSchema.safeParse({ interval, options });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const [profile] = await db
    .select({
      stripeAccountId: sellerProfile.stripeAccountId,
      stripeOnboarded: sellerProfile.stripeOnboarded,
      storeTier: sellerProfile.storeTier,
      sellerType: sellerProfile.sellerType,
    })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!profile?.stripeAccountId || !profile.stripeOnboarded) {
    return { success: false, error: 'Stripe account not connected' };
  }

  if (profile.sellerType === 'PERSONAL' && interval !== 'manual') {
    return { success: false, error: 'Personal sellers can only use manual payouts.' };
  }

  // Validate interval is allowed for this tier
  const tier = (profile.storeTier ?? 'NONE') as StoreTier;
  const tierOptions = TIER_PAYOUT_OPTIONS;
  const allowedIntervals = tierOptions[tier] ?? tierOptions.NONE;

  if (!allowedIntervals.includes(interval)) {
    return {
      success: false,
      error: `${interval} payouts are not available for your store tier. Upgrade to unlock more options.`,
    };
  }

  return updatePayoutSchedule(profile.stripeAccountId, interval, options);
}

interface PayoutTaxGateResult {
  success: boolean;
  blocked: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Check if seller is blocked from requesting payouts due to missing tax info.
 * G5.3: If seller's YTD gross >= tax.1099kThresholdCents and no taxInfo row, block payout.
 * Called before any payout disbursement.
 */
export async function checkPayoutTaxGateAction(): Promise<PayoutTaxGateResult> {
  const { session, ability } = await authorize();

  if (!session) {
    return { success: false, blocked: true, error: 'Please sign in to continue' };
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('Payout', { userId }))) {
    return { success: false, blocked: true, error: 'Not authorized' };
  }

  const status = await checkThresholdStatus(userId);

  if (status.needsTaxInfo) {
    void import('@/lib/notifications/service').then(({ notify: n }) =>
      n(userId, 'tax.info_required_payout_blocked', {
        thresholdFormatted: `$${(status.thresholdCents / 100).toFixed(2)}`,
      })
    );

    return {
      success: true,
      blocked: true,
      error:
        'Tax information required. Please complete your tax details at /my/selling/tax before requesting your next payout.',
      redirectTo: '/my/selling/tax',
    };
  }

  return { success: true, blocked: false };
}
