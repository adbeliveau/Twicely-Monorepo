import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAuthorize = vi.fn();

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ host: 'localhost:3000', 'x-forwarded-proto': 'https' })
  ),
}));

vi.mock('@twicely/casl', () => ({
  authorize: () => mockAuthorize(),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions, __caslSubjectType__: type,
  }),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

const subCols = {
  sellerProfileId: 'seller_profile_id', status: 'status',
  stripeSubscriptionId: 'stripe_subscription_id',
};
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    id: 'id', sellerType: 'seller_type', stripeCustomerId: 'stripe_customer_id',
  },
  storeSubscription: subCols, listerSubscription: subCols,
  automationSubscription: subCols, financeSubscription: subCols,
  bundleSubscription: { ...subCols },
}));

vi.mock('drizzle-orm', () => ({ eq: vi.fn((a, b) => ({ type: 'eq', a, b })) }));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    subscriptions: { cancel: vi.fn() },
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}));

vi.mock('@twicely/subscriptions/price-map', () => ({ getStripePriceId: vi.fn() }));
vi.mock('@/lib/mutations/subscriptions', () => ({ setStripeCustomerId: vi.fn() }));
vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn().mockResolvedValue('sp_1'),
}));

// ─── Imports + Typed Mocks ──────────────────────────────────────────────────

import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';

const mockDb = vi.mocked(db);
const mockStripeCancel = vi.mocked(stripe.subscriptions.cancel);
const mockCreateCheckout = vi.mocked(stripe.checkout.sessions.create);
const mockGetPriceId = vi.mocked(getStripePriceId);
const mockGetSellerProfileId = vi.mocked(getSellerProfileIdByUserId);

// ─── Helpers ────────────────────────────────────────────────────────────────

function createAbility(canCreate = true) {
  return { can: vi.fn().mockReturnValue(canCreate) };
}
function createSession() {
  return { userId: 'user_1', delegationId: null };
}
function selectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(data) }),
    }),
  };
}

function setupDbCalls(...calls: unknown[][]) {
  let callCount = 0;
  mockDb.select.mockImplementation(() => {
    const data = calls[callCount] ?? [];
    callCount++;
    return selectChain(data) as never;
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('D3-S5: createBundleCheckout', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects unauthenticated users', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: null });
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'PRO', billingInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('rejects users without CASL permission', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(false), session: createSession() });
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'PRO', billingInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Insufficient permissions' });
  });

  it('rejects when sellerProfileId not found', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetSellerProfileId.mockResolvedValueOnce(null);
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'PRO', billingInterval: 'monthly' });
    expect(r).toEqual({ success: false, error: 'Seller profile not found' });
  });

  it('rejects PERSONAL seller', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    setupDbCalls([{ sellerType: 'PERSONAL', stripeCustomerId: null }]);
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'PRO', billingInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Business');
  });

  it('rejects if already on active bundle', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    setupDbCalls(
      [{ sellerType: 'BUSINESS', stripeCustomerId: 'cus_1' }],
      [{ status: 'ACTIVE' }],
    );
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'PRO', billingInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Change Plan');
  });

  it('creates Stripe checkout session with correct price and metadata', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    // Call order: 1=profile, 2=bundle check, 3-6=individual sub checks
    setupDbCalls(
      [{ sellerType: 'BUSINESS', stripeCustomerId: 'cus_1' }],
      [], [], [], [], [],
    );
    mockGetPriceId.mockReturnValue('price_bundle_pro_monthly');
    mockCreateCheckout.mockResolvedValue({ url: 'https://checkout.stripe.com/sess_1' } as never);
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'PRO', billingInterval: 'monthly' });
    expect(r.success).toBe(true);
    expect(r.checkoutUrl).toBe('https://checkout.stripe.com/sess_1');
    expect(mockCreateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_bundle_pro_monthly', quantity: 1 }],
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({ product: 'bundle', tier: 'PRO' }),
        }),
      })
    );
  });

  it('cancels existing individual subs before creating checkout', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    setupDbCalls(
      [{ sellerType: 'BUSINESS', stripeCustomerId: 'cus_1' }],
      [],
      [{ stripeSubscriptionId: 'sub_store', status: 'ACTIVE' }],
      [],
      [],
      [{ stripeSubscriptionId: 'sub_fin', status: 'ACTIVE' }],
    );
    mockStripeCancel.mockResolvedValue({} as never);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    mockGetPriceId.mockReturnValue('price_bundle_power_annual');
    mockCreateCheckout.mockResolvedValue({ url: 'https://checkout.stripe.com/s2' } as never);
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'POWER', billingInterval: 'annual' });
    expect(r.success).toBe(true);
    expect(mockStripeCancel).toHaveBeenCalledTimes(2);
  });

  it('returns error when checkout session has no URL', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    setupDbCalls(
      [{ sellerType: 'BUSINESS', stripeCustomerId: 'cus_1' }],
      [], [], [], [], [],
    );
    mockGetPriceId.mockReturnValue('price_bundle_starter_monthly');
    mockCreateCheckout.mockResolvedValue({ url: null } as never);
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'STARTER', billingInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('checkout session');
  });

  it('returns error when price ID not resolved', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    setupDbCalls(
      [{ sellerType: 'BUSINESS', stripeCustomerId: 'cus_1' }],
      [], [], [], [], [],
    );
    mockGetPriceId.mockReturnValue(null);
    const { createBundleCheckout } = await import('../create-bundle-checkout');
    const r = await createBundleCheckout({ bundleTier: 'STARTER', billingInterval: 'monthly' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Invalid');
  });
});
