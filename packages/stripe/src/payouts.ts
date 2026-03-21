/**
 * Stripe Payouts — Balance & Payout Management
 *
 * Retrieves seller balance and payout history via Stripe Connect.
 * All calls made with stripeAccount header for connected account access.
 */

import { stripe } from './server';
import type Stripe from 'stripe';
import { logger } from '@twicely/logger';

export interface BalanceResult {
  success: boolean;
  balance?: {
    available: BalanceAmount[];
    pending: BalanceAmount[];
    instantAvailable?: BalanceAmount[];
  };
  error?: string;
}

export interface BalanceAmount {
  amount: number;
  currency: string;
}

export interface PayoutHistoryResult {
  success: boolean;
  payouts?: PayoutItem[];
  hasMore?: boolean;
  error?: string;
}

export type PayoutStatus = 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';

export interface PayoutItem {
  id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  arrivalDate: Date;
  createdAt: Date;
  method: string;
  description: string | null;
}

export interface PayoutScheduleResult {
  success: boolean;
  schedule?: {
    delayDays: number;
    interval: 'manual' | 'daily' | 'weekly' | 'monthly';
    weeklyAnchor?: string;
    monthlyAnchor?: number;
  };
  error?: string;
}

/**
 * Get balance for a connected account.
 * Returns available, pending, and instant available amounts.
 */
export async function getSellerBalance(stripeAccountId: string): Promise<BalanceResult> {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: stripeAccountId,
    });

    return {
      success: true,
      balance: {
        available: balance.available.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
        pending: balance.pending.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
        instantAvailable: balance.instant_available?.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
      },
    };
  } catch (error) {
    logger.error('Failed to get seller balance', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance',
    };
  }
}

/**
 * Get payout history for a connected account.
 * Paginated with cursor-based pagination.
 */
export async function getPayoutHistory(
  stripeAccountId: string,
  limit: number = 10,
  startingAfter?: string
): Promise<PayoutHistoryResult> {
  try {
    const params: Stripe.PayoutListParams = {
      limit,
    };
    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    const payouts = await stripe.payouts.list(params, {
      stripeAccount: stripeAccountId,
    });

    return {
      success: true,
      payouts: payouts.data.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status as PayoutStatus,
        arrivalDate: new Date(p.arrival_date * 1000),
        createdAt: new Date(p.created * 1000),
        method: p.method ?? 'standard',
        description: p.description,
      })),
      hasMore: payouts.has_more,
    };
  } catch (error) {
    logger.error('Failed to get payout history', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get payout history',
    };
  }
}

/**
 * Get current payout schedule for a connected account.
 */
export async function getPayoutSchedule(stripeAccountId: string): Promise<PayoutScheduleResult> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const schedule = account.settings?.payouts?.schedule;

    if (!schedule) {
      return {
        success: true,
        schedule: {
          delayDays: 2,
          interval: 'daily',
        },
      };
    }

    return {
      success: true,
      schedule: {
        delayDays: schedule.delay_days ?? 2,
        interval: schedule.interval as 'manual' | 'daily' | 'weekly' | 'monthly',
        weeklyAnchor: schedule.weekly_anchor,
        monthlyAnchor: schedule.monthly_anchor,
      },
    };
  } catch (error) {
    logger.error('Failed to get payout schedule', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get payout schedule',
    };
  }
}

/**
 * Update payout schedule for a connected account.
 * Schedule options are gated by store tier (handled in payout-settings action).
 */
export async function updatePayoutSchedule(
  stripeAccountId: string,
  interval: 'manual' | 'daily' | 'weekly' | 'monthly',
  options?: {
    weeklyAnchor?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
    monthlyAnchor?: number;
    delayDays?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const scheduleUpdate: Stripe.AccountUpdateParams.Settings.Payouts.Schedule = {
      interval,
    };

    if (interval === 'weekly' && options?.weeklyAnchor) {
      scheduleUpdate.weekly_anchor = options.weeklyAnchor;
    }

    if (interval === 'monthly' && options?.monthlyAnchor) {
      scheduleUpdate.monthly_anchor = options.monthlyAnchor;
    }

    if (options?.delayDays !== undefined) {
      scheduleUpdate.delay_days = options.delayDays;
    }

    await stripe.accounts.update(stripeAccountId, {
      settings: {
        payouts: {
          schedule: scheduleUpdate,
        },
      },
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update payout schedule', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update payout schedule',
    };
  }
}

/**
 * Format balance amount for display.
 */
export function formatBalanceAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Get payout status display text.
 */
export function getPayoutStatusLabel(status: PayoutStatus): string {
  const labels: Record<PayoutStatus, string> = {
    paid: 'Completed',
    pending: 'Pending',
    in_transit: 'In Transit',
    canceled: 'Canceled',
    failed: 'Failed',
  };
  return labels[status] ?? status;
}
