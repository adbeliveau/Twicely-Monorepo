import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAuthorize = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: () => mockAuthorize(),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions, __caslSubjectType__: type,
  }),
}));

const mockTx = { select: vi.fn(), update: vi.fn() };

vi.mock('@twicely/db', () => ({
  db: {
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    id: 'id', sellerType: 'seller_type', storeTier: 'store_tier',
    listerTier: 'lister_tier', financeTier: 'finance_tier',
    hasAutomation: 'has_automation', bundleTier: 'bundle_tier', updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/db/schema/subscriptions', () => {
  const cols = {
    id: 'id', tier: 'tier', stripePriceId: 'stripe_price_id',
    stripeSubscriptionId: 'stripe_subscription_id', sellerProfileId: 'seller_profile_id',
    currentPeriodEnd: 'current_period_end', pendingTier: 'pending_tier',
    pendingBillingInterval: 'pending_billing_interval', pendingChangeAt: 'pending_change_at',
    updatedAt: 'updated_at',
  };
  return {
    storeSubscription: cols, listerSubscription: cols,
    financeSubscription: cols, bundleSubscription: cols,
  };
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));

vi.mock('@twicely/stripe/server', () => ({
  stripe: { subscriptions: { retrieve: vi.fn(), update: vi.fn() } },
}));

vi.mock('@twicely/subscriptions/price-map', () => ({ getStripePriceId: vi.fn() }));

vi.mock('@twicely/subscriptions/subscription-engine', () => ({
  classifySubscriptionChange: vi.fn(),
  getBillingIntervalFromPriceId: vi.fn(),
}));

vi.mock('@twicely/subscriptions/bundle-resolution', () => ({
  resolveBundleComponents: vi.fn(),
}));

vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn().mockResolvedValue('sp_1'),
}));

// ─── Imports + Typed Mocks ──────────────────────────────────────────────────

import { stripe } from '@twicely/stripe/server';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import { classifySubscriptionChange, getBillingIntervalFromPriceId } from '@twicely/subscriptions/subscription-engine';
import { resolveBundleComponents } from '@twicely/subscriptions/bundle-resolution';

const mockClassify = vi.mocked(classifySubscriptionChange);
const mockGetInterval = vi.mocked(getBillingIntervalFromPriceId);
const mockGetPriceId = vi.mocked(getStripePriceId);
const mockStripeRetrieve = vi.mocked(stripe.subscriptions.retrieve);
const mockStripeUpdate = vi.mocked(stripe.subscriptions.update);
const mockResolveBundle = vi.mocked(resolveBundleComponents);

// ─── Helpers ────────────────────────────────────────────────────────────────

function createAbility(canUpdate = true) { return { can: vi.fn().mockReturnValue(canUpdate) }; }
function createSession(opts: { sellerId?: string | null } = {}) {
  return { userId: 'user_1', sellerId: opts.sellerId !== undefined ? opts.sellerId : 'sp_1' };
}
function chainForUpdate(data: unknown[]) {
  return { from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      for: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(data) }),
      limit: vi.fn().mockResolvedValue(data),
    }),
  }) };
}
function chainUpdate() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

const BUNDLE_ROW = {
  id: 'bsub_1', tier: 'STARTER', stripePriceId: 'price_bundle_starter_monthly',
  stripeSubscriptionId: 'sub_stripe_bundle_1', currentPeriodEnd: new Date('2026-04-01'),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('D3-S5: changeSubscriptionAction — bundle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls Stripe update on bundle UPGRADE', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([BUNDLE_ROW]));
    mockTx.update.mockReturnValue(chainUpdate());
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    mockGetPriceId.mockReturnValue('price_bundle_pro_monthly');
    mockStripeRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } } as never);
    mockStripeUpdate.mockResolvedValue({} as never);
    mockResolveBundle.mockReturnValue({
      storeTier: 'PRO', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: false,
    });
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'bundle', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(true);
    expect(r.classification).toBe('UPGRADE');
    expect(mockStripeUpdate).toHaveBeenCalled();
  });

  it('syncs all component tiers on bundle UPGRADE via resolveBundleComponents', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([BUNDLE_ROW]));
    const uc = chainUpdate();
    mockTx.update.mockReturnValue(uc);
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    mockGetPriceId.mockReturnValue('price_bundle_power_monthly');
    mockStripeRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } } as never);
    mockStripeUpdate.mockResolvedValue({} as never);
    mockResolveBundle.mockReturnValue({
      storeTier: 'POWER', listerTier: 'PRO', financeTier: 'PRO', hasAutomation: true,
    });
    const { changeSubscriptionAction } = await import('../change-subscription');
    await changeSubscriptionAction({ product: 'bundle', targetTier: 'POWER', targetInterval: 'monthly' });
    expect(mockResolveBundle).toHaveBeenCalledWith('POWER');
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      bundleTier: 'POWER', storeTier: 'POWER', listerTier: 'PRO',
      financeTier: 'PRO', hasAutomation: true,
    }));
  });

  it('stores pending on bundle DOWNGRADE without Stripe call', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([{ ...BUNDLE_ROW, tier: 'POWER' }]));
    mockTx.update.mockReturnValue(chainUpdate());
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('DOWNGRADE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'bundle', targetTier: 'STARTER', targetInterval: 'monthly' });
    expect(r.success).toBe(true);
    expect(r.classification).toBe('DOWNGRADE');
    expect(mockStripeUpdate).not.toHaveBeenCalled();
  });

  it('returns error for bundle NO_CHANGE', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([BUNDLE_ROW]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('NO_CHANGE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'bundle', targetTier: 'STARTER', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('already on this plan');
  });

  it('returns BLOCKED for Enterprise-related changes', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([BUNDLE_ROW]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('BLOCKED');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'bundle', targetTier: 'POWER', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Enterprise');
  });

  it('rejects PERSONAL seller for bundle change', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select
      .mockReturnValueOnce(chainForUpdate([BUNDLE_ROW]))
      .mockReturnValueOnce(chainForUpdate([{ sellerType: 'PERSONAL' }]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'bundle', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Upgrade to Business first');
  });
});
