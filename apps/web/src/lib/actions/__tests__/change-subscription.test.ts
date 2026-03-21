import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: () => mockAuthorize(),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions, __caslSubjectType__: type,
  }),
}));

// Transaction mock: shared tx object accessible from tests
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
    id: 'id', sellerType: 'seller_type', sellerProfileId: 'seller_profile_id',
    storeTier: 'store_tier', listerTier: 'lister_tier', financeTier: 'finance_tier',
    updatedAt: 'updated_at',
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
  return { storeSubscription: cols, listerSubscription: cols, financeSubscription: cols };
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

vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn().mockResolvedValue('sp_1'),
}));

import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import { classifySubscriptionChange, getBillingIntervalFromPriceId } from '@twicely/subscriptions/subscription-engine';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';

const mockClassify = vi.mocked(classifySubscriptionChange);
const mockGetInterval = vi.mocked(getBillingIntervalFromPriceId);
const mockGetPriceId = vi.mocked(getStripePriceId);
const mockStripeRetrieve = vi.mocked(stripe.subscriptions.retrieve);
const mockStripeUpdate = vi.mocked(stripe.subscriptions.update);
const mockGetSellerProfileId = vi.mocked(getSellerProfileIdByUserId);

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

const SUB_ROW = {
  id: 'sub_1', tier: 'STARTER', stripePriceId: 'price_store_starter_monthly',
  stripeSubscriptionId: 'sub_stripe_1', currentPeriodEnd: new Date('2026-04-01'),
};

describe('D3-S4: changeSubscriptionAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: null });
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects users without subscription update permission', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(false), session: createSession() });
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Insufficient permissions' });
  });

  it('rejects non-sellers (no sellerProfileId)', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession({ sellerId: null }) });
    mockGetSellerProfileId.mockResolvedValueOnce(null);
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Seller profile not found' });
  });

  it('rejects invalid tier for product', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'LITE', targetInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Invalid tier for this product' });
  });

  it('returns error for NO_CHANGE classification', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([{ ...SUB_ROW, tier: 'PRO' }]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('NO_CHANGE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('already on this plan');
  });

  it('returns error for BLOCKED (Enterprise)', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([SUB_ROW]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('BLOCKED');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'POWER', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Enterprise');
  });

  it('calls stripe.subscriptions.update on UPGRADE with create_prorations', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([SUB_ROW]));
    mockTx.update.mockReturnValue(chainUpdate());
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    mockGetPriceId.mockReturnValue('price_store_pro_monthly');
    mockStripeRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } } as never);
    mockStripeUpdate.mockResolvedValue({} as never);
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(true);
    expect(r.classification).toBe('UPGRADE');
    expect(mockStripeUpdate).toHaveBeenCalledWith('sub_stripe_1', {
      items: [{ id: 'si_1', price: 'price_store_pro_monthly' }],
      proration_behavior: 'create_prorations',
    });
  });

  it('clears pending fields and updates sellerProfile on UPGRADE', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([SUB_ROW]));
    const uc = chainUpdate();
    mockTx.update.mockReturnValue(uc);
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    mockGetPriceId.mockReturnValue('price_store_pro_monthly');
    mockStripeRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } } as never);
    mockStripeUpdate.mockResolvedValue({} as never);
    const { changeSubscriptionAction } = await import('../change-subscription');
    await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    // Updates subscription table + sellerProfile = 2 calls
    expect(mockTx.update).toHaveBeenCalledTimes(2);
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      pendingTier: null, pendingBillingInterval: null, pendingChangeAt: null,
    }));
    // Second call updates sellerProfile with denormalized tier
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      storeTier: 'PRO',
    }));
  });

  it('does NOT call Stripe on DOWNGRADE', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([{ ...SUB_ROW, tier: 'POWER' }]));
    mockTx.update.mockReturnValue(chainUpdate());
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('DOWNGRADE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(true);
    expect(mockStripeUpdate).not.toHaveBeenCalled();
  });

  it('sets pendingTier and pendingChangeAt on DOWNGRADE', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([{ ...SUB_ROW, tier: 'POWER' }]));
    const uc = chainUpdate();
    mockTx.update.mockReturnValue(uc);
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('DOWNGRADE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      pendingTier: 'PRO', pendingChangeAt: SUB_ROW.currentPeriodEnd,
    }));
  });

  it('sets only pendingBillingInterval on INTERVAL_DOWNGRADE (not pendingTier)', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([{ ...SUB_ROW, tier: 'PRO', stripePriceId: 'price_store_pro_annual' }]));
    const uc = chainUpdate();
    mockTx.update.mockReturnValue(uc);
    mockGetInterval.mockReturnValue('annual');
    mockClassify.mockReturnValue('INTERVAL_DOWNGRADE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(true);
    expect(r.classification).toBe('INTERVAL_DOWNGRADE');
    expect(mockStripeUpdate).not.toHaveBeenCalled();
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      pendingBillingInterval: 'monthly',
    }));
    // Should NOT contain pendingTier since it's an interval-only change
    const setArg = uc.set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(setArg).toBeDefined();
    expect(setArg).not.toHaveProperty('pendingTier');
  });

  it('wraps Stripe errors and returns error', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select.mockReturnValue(chainForUpdate([SUB_ROW]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    mockGetPriceId.mockReturnValue('price_store_pro_monthly');
    mockStripeRetrieve.mockResolvedValue({ items: { data: [{ id: 'si_1' }] } } as never);
    mockStripeUpdate.mockRejectedValue(new Error('Stripe error'));
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to update subscription');
  });

  it('rejects PERSONAL seller trying to upgrade store', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockTx.select
      .mockReturnValueOnce(chainForUpdate([SUB_ROW]))
      .mockReturnValueOnce(chainForUpdate([{ sellerType: 'PERSONAL' }]));
    mockGetInterval.mockReturnValue('monthly');
    mockClassify.mockReturnValue('UPGRADE');
    const { changeSubscriptionAction } = await import('../change-subscription');
    const r = await changeSubscriptionAction({ product: 'store', targetTier: 'PRO', targetInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('Upgrade to Business first');
  });
});

describe('D3-S4: cancelPendingChangeAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: null });
    const { cancelPendingChangeAction } = await import('../change-subscription');
    const r = await cancelPendingChangeAction({ product: 'store' });
    expect(r).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects users without permissions', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(false), session: createSession() });
    const { cancelPendingChangeAction } = await import('../change-subscription');
    const r = await cancelPendingChangeAction({ product: 'store' });
    expect(r).toEqual({ success: false, error: 'Insufficient permissions' });
  });

  it('clears pending fields successfully', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    const mockDb = vi.mocked(db);
    const sc = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'sub_1' }]) }),
      }),
    };
    const uc = chainUpdate();
    mockDb.select.mockReturnValue(sc as never);
    mockDb.update.mockReturnValue(uc as never);
    const { cancelPendingChangeAction } = await import('../change-subscription');
    const r = await cancelPendingChangeAction({ product: 'store' });
    expect(r).toEqual({ success: true });
    expect(uc.set).toHaveBeenCalledWith(expect.objectContaining({
      pendingTier: null, pendingBillingInterval: null, pendingChangeAt: null,
    }));
  });
});
