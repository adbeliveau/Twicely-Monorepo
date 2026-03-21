import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));

vi.mock('@twicely/db/schema/subscriptions', () => {
  const cols = {
    id: 'id', status: 'status', stripeSubscriptionId: 'stripe_subscription_id',
    stripePriceId: 'stripe_price_id', currentPeriodEnd: 'current_period_end',
    cancelAtPeriodEnd: 'cancel_at_period_end', sellerProfileId: 'seller_profile_id',
    pendingTier: 'pending_tier', pendingBillingInterval: 'pending_billing_interval',
    pendingChangeAt: 'pending_change_at',
  };
  const autoCols = {
    ...cols, creditsIncluded: 'credits_included', creditsUsed: 'credits_used',
  };
  return {
    storeSubscription: cols, listerSubscription: cols,
    automationSubscription: autoCols, financeSubscription: cols,
    bundleSubscription: cols,
  };
});

vi.mock('@twicely/db/schema/identity', () => ({
  sellerProfile: {
    id: 'id', userId: 'user_id', storeTier: 'store_tier', listerTier: 'lister_tier',
    financeTier: 'finance_tier', hasAutomation: 'has_automation', bundleTier: 'bundle_tier',
  },
}));

vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));

vi.mock('@twicely/subscriptions/subscription-engine', () => ({
  getBillingIntervalFromPriceId: vi.fn(),
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { db } from '@twicely/db';
import { getBillingIntervalFromPriceId } from '@twicely/subscriptions/subscription-engine';

const mockDb = vi.mocked(db);
const mockGetInterval = vi.mocked(getBillingIntervalFromPriceId);

// ─── Helpers ────────────────────────────────────────────────────────────────

function selectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(data) }),
    }),
  };
}

const PROFILE = {
  storeTier: 'STARTER', listerTier: 'NONE', financeTier: 'PRO',
  hasAutomation: false, bundleTier: 'STARTER',
};

const BUNDLE_SUB = {
  id: 'bsub_1', status: 'ACTIVE', stripeSubscriptionId: 'sub_bundle_1',
  stripePriceId: 'price_bundle_starter_monthly', currentPeriodEnd: new Date('2026-04-01'),
  cancelAtPeriodEnd: false, pendingTier: null,
  pendingBillingInterval: null, pendingChangeAt: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('D3-S5: getSubscriptionSnapshot', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when profile not found', async () => {
    mockDb.select.mockReturnValue(selectChain([]) as never);
    const { getSubscriptionSnapshot } = await import('../subscriptions');
    const result = await getSubscriptionSnapshot('sp_nonexistent');
    expect(result).toBeNull();
  });

  it('includes bundle fields in snapshot', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain([PROFILE]) as never;
      if (callCount === 6) return selectChain([BUNDLE_SUB]) as never;
      return selectChain([]) as never;
    });
    mockGetInterval.mockReturnValue('monthly');
    const { getSubscriptionSnapshot } = await import('../subscriptions');
    const snap = await getSubscriptionSnapshot('sp_1');
    expect(snap).not.toBeNull();
    expect(snap!.bundleTier).toBe('STARTER');
    expect(snap!.bundleSubscription).toEqual(BUNDLE_SUB);
  });

  it('returns bundleSubscription as null when no bundle exists', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain([{ ...PROFILE, bundleTier: 'NONE' }]) as never;
      return selectChain([]) as never;
    });
    const { getSubscriptionSnapshot } = await import('../subscriptions');
    const snap = await getSubscriptionSnapshot('sp_1');
    expect(snap).not.toBeNull();
    expect(snap!.bundleTier).toBe('NONE');
    expect(snap!.bundleSubscription).toBeNull();
  });

  it('derives bundleBillingInterval from stripePriceId', async () => {
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain([PROFILE]) as never;
      if (callCount === 6) return selectChain([BUNDLE_SUB]) as never;
      return selectChain([]) as never;
    });
    mockGetInterval.mockImplementation((priceId: string) => {
      if (priceId === 'price_bundle_starter_monthly') return 'monthly';
      return null;
    });
    const { getSubscriptionSnapshot } = await import('../subscriptions');
    const snap = await getSubscriptionSnapshot('sp_1');
    expect(snap!.bundleBillingInterval).toBe('monthly');
  });

  it('returns bundlePendingTier from bundle subscription', async () => {
    const pendingSub = {
      ...BUNDLE_SUB, pendingTier: 'PRO',
      pendingBillingInterval: 'annual', pendingChangeAt: new Date('2026-04-01'),
    };
    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain([PROFILE]) as never;
      if (callCount === 6) return selectChain([pendingSub]) as never;
      return selectChain([]) as never;
    });
    mockGetInterval.mockReturnValue('monthly');
    const { getSubscriptionSnapshot } = await import('../subscriptions');
    const snap = await getSubscriptionSnapshot('sp_1');
    expect(snap!.bundlePendingTier).toBe('PRO');
    expect(snap!.bundlePendingBillingInterval).toBe('annual');
    expect(snap!.bundlePendingChangeAt).toEqual(new Date('2026-04-01'));
  });
});
