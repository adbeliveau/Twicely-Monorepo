import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// ─── Shared mock objects (defined before vi.mock) ───────────────────────────

const mockTx = { update: vi.fn() };

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', storeTier: 'store_tier', listerTier: 'lister_tier', financeTier: 'finance_tier', updatedAt: 'updated_at' },
  storeSubscription: {
    id: 'id', stripeSubscriptionId: 'stripe_subscription_id', sellerProfileId: 'seller_profile_id',
    tier: 'tier', stripePriceId: 'stripe_price_id', pendingTier: 'pending_tier',
    pendingBillingInterval: 'pending_billing_interval', pendingChangeAt: 'pending_change_at',
    updatedAt: 'updated_at',
  },
  listerSubscription: {
    id: 'id', stripeSubscriptionId: 'stripe_subscription_id', sellerProfileId: 'seller_profile_id',
    tier: 'tier', stripePriceId: 'stripe_price_id', pendingTier: 'pending_tier',
    pendingBillingInterval: 'pending_billing_interval', pendingChangeAt: 'pending_change_at',
    updatedAt: 'updated_at',
  },
  financeSubscription: {
    id: 'id', stripeSubscriptionId: 'stripe_subscription_id', sellerProfileId: 'seller_profile_id',
    tier: 'tier', stripePriceId: 'stripe_price_id', pendingTier: 'pending_tier',
    pendingBillingInterval: 'pending_billing_interval', pendingChangeAt: 'pending_change_at',
    updatedAt: 'updated_at',
  },
  bundleSubscription: {
    id: 'id', stripeSubscriptionId: 'stripe_subscription_id', sellerProfileId: 'seller_profile_id',
    tier: 'tier', stripePriceId: 'stripe_price_id', pendingTier: 'pending_tier',
    pendingBillingInterval: 'pending_billing_interval', pendingChangeAt: 'pending_change_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));

vi.mock('@twicely/stripe/server', () => ({
  stripe: { subscriptions: { update: vi.fn() } },
}));

vi.mock('@twicely/subscriptions/price-map', () => ({ getStripePriceId: vi.fn() }));

vi.mock('@twicely/subscriptions/subscription-engine', () => ({
  getBillingIntervalFromPriceId: vi.fn(),
}));

vi.mock('@twicely/subscriptions/bundle-resolution', () => ({
  resolveBundleComponents: vi.fn(),
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import { getBillingIntervalFromPriceId } from '@twicely/subscriptions/subscription-engine';

const mockDb = vi.mocked(db);
const mockStripeUpdate = vi.mocked(stripe.subscriptions.update);
const mockGetPriceId = vi.mocked(getStripePriceId);
const mockGetInterval = vi.mocked(getBillingIntervalFromPriceId);

// ─── Helpers ────────────────────────────────────────────────────────────────

function selectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(data) }),
    }),
  };
}

function updateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

const mockStripeSub = {
  items: { data: [{ id: 'si_1' }] },
} as unknown as Stripe.Subscription;

const pastDate = new Date('2026-01-01');
const futureDate = new Date('2099-12-31');

const PENDING_ROW = {
  subscriptionId: 'sub_1', sellerProfileId: 'sp_1', currentTier: 'PRO',
  stripePriceId: 'price_store_pro_monthly',
  pendingTier: 'STARTER', pendingBillingInterval: null, pendingChangeAt: pastDate,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('D3-S4: applyPendingDowngradeIfNeeded', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does nothing when no pending change exists', async () => {
    mockDb.select.mockReturnValue(selectChain([{
      ...PENDING_ROW, pendingTier: null, pendingBillingInterval: null, pendingChangeAt: null,
    }]) as never);
    const { applyPendingDowngradeIfNeeded } = await import('../apply-pending-downgrade');
    await applyPendingDowngradeIfNeeded('sub_stripe_1', mockStripeSub);
    expect(mockStripeUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when pendingChangeAt is in the future', async () => {
    mockDb.select.mockReturnValue(selectChain([{
      ...PENDING_ROW, pendingChangeAt: futureDate,
    }]) as never);
    const { applyPendingDowngradeIfNeeded } = await import('../apply-pending-downgrade');
    await applyPendingDowngradeIfNeeded('sub_stripe_1', mockStripeSub);
    expect(mockStripeUpdate).not.toHaveBeenCalled();
  });

  it('calls stripe.subscriptions.update with proration_behavior: none', async () => {
    mockDb.select.mockReturnValue(selectChain([PENDING_ROW]) as never);
    mockGetInterval.mockReturnValue('monthly');
    mockGetPriceId.mockReturnValue('price_store_starter_monthly');
    mockStripeUpdate.mockResolvedValue({} as never);
    mockTx.update.mockReturnValue(updateChain());
    const { applyPendingDowngradeIfNeeded } = await import('../apply-pending-downgrade');
    await applyPendingDowngradeIfNeeded('sub_stripe_1', mockStripeSub);
    expect(mockStripeUpdate).toHaveBeenCalledWith('sub_stripe_1', {
      items: [{ id: 'si_1', price: 'price_store_starter_monthly' }],
      proration_behavior: 'none',
    });
  });

  it('clears pending fields after applying downgrade', async () => {
    mockDb.select.mockReturnValue(selectChain([PENDING_ROW]) as never);
    mockGetInterval.mockReturnValue('monthly');
    mockGetPriceId.mockReturnValue('price_store_starter_monthly');
    mockStripeUpdate.mockResolvedValue({} as never);
    const uc = updateChain();
    mockTx.update.mockReturnValue(uc);
    const { applyPendingDowngradeIfNeeded } = await import('../apply-pending-downgrade');
    await applyPendingDowngradeIfNeeded('sub_stripe_1', mockStripeSub);
    expect(mockTx.update).toHaveBeenCalledTimes(2);
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      pendingTier: null, pendingBillingInterval: null, pendingChangeAt: null,
    }));
  });

  it('re-throws Stripe error so webhook returns 500 for retry', async () => {
    mockDb.select.mockReturnValue(selectChain([PENDING_ROW]) as never);
    mockGetInterval.mockReturnValue('monthly');
    mockGetPriceId.mockReturnValue('price_store_starter_monthly');
    mockStripeUpdate.mockRejectedValue(new Error('Stripe error'));
    const { applyPendingDowngradeIfNeeded } = await import('../apply-pending-downgrade');
    await expect(applyPendingDowngradeIfNeeded('sub_stripe_1', mockStripeSub))
      .rejects.toThrow('Stripe error');
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('does nothing when subscription not found in any table', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([]) as never)
      .mockReturnValueOnce(selectChain([]) as never);
    const { applyPendingDowngradeIfNeeded } = await import('../apply-pending-downgrade');
    await applyPendingDowngradeIfNeeded('sub_nonexistent', mockStripeSub);
    expect(mockStripeUpdate).not.toHaveBeenCalled();
  });
});
