import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockAuthorize = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: () => mockAuthorize(),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions, __caslSubjectType__: type,
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ host: 'localhost:3000', 'x-forwarded-proto': 'https' })
  ),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', stripeCustomerId: 'stripe_customer_id' },
  bundleSubscription: {
    stripeSubscriptionId: 'stripe_subscription_id',
    sellerProfileId: 'seller_profile_id',
    cancelAtPeriodEnd: 'cancel_at_period_end',
    pendingTier: 'pending_tier',
    pendingBillingInterval: 'pending_billing_interval',
    pendingChangeAt: 'pending_change_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
}));

vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn().mockResolvedValue('sp_1'),
  getStripeSubscriptionId: vi.fn(),
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    subscriptions: { update: vi.fn() },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

// ─── Imports + Typed Mocks ──────────────────────────────────────────────────

import { db } from '@twicely/db';
import {
  getSellerProfileIdByUserId,
  getStripeSubscriptionId,
} from '@/lib/queries/subscriptions';
import { stripe } from '@twicely/stripe/server';

const mockGetSellerProfileId = vi.mocked(getSellerProfileIdByUserId);
const mockGetStripeSubId = vi.mocked(getStripeSubscriptionId);
const mockUpdateSub = vi.mocked(stripe.subscriptions.update);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockPortalCreate = vi.mocked(stripe.billingPortal.sessions.create);

// ─── Helpers ────────────────────────────────────────────────────────────────

function createAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function createSession(opts: { sellerId?: string | null } = {}) {
  return {
    userId: 'user_1',
    sellerId: opts.sellerId !== undefined ? opts.sellerId : 'sp_1',
  };
}

function selectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(data),
      }),
    }),
  };
}

function updateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── Cancel Tests (non-bundle) ───────────────────────────────────────────────

describe('D3-S3: cancelSubscriptionAction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error for invalid input (Zod)', async () => {
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'invalid' as 'store' });
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: null });
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'store' });
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when CASL denies permission', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(false), session: createSession() });
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'store' });
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' });
  });

  it('returns error when seller profile not found', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession({ sellerId: null }) });
    mockGetSellerProfileId.mockResolvedValueOnce(null);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'store' });
    expect(result).toEqual({ success: false, error: 'Seller profile not found' });
  });

  it('returns error when no active subscription found', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetStripeSubId.mockResolvedValue(null);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'store' });
    expect(result).toEqual({ success: false, error: 'No active subscription found' });
  });

  it('calls stripe.subscriptions.update with cancel_at_period_end for store', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetStripeSubId.mockResolvedValue('sub_stripe_123');
    mockUpdateSub.mockResolvedValue({} as never);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'store' });
    expect(result).toEqual({ success: true });
    expect(mockUpdateSub).toHaveBeenCalledWith('sub_stripe_123', { cancel_at_period_end: true });
  });

  it('calls stripe.subscriptions.update for lister cancel', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetStripeSubId.mockResolvedValue('sub_lister_456');
    mockUpdateSub.mockResolvedValue({} as never);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'lister' });
    expect(result).toEqual({ success: true });
    expect(mockUpdateSub).toHaveBeenCalledWith('sub_lister_456', { cancel_at_period_end: true });
  });

  it('calls stripe.subscriptions.update for automation cancel', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetStripeSubId.mockResolvedValue('sub_auto_789');
    mockUpdateSub.mockResolvedValue({} as never);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'automation' });
    expect(result).toEqual({ success: true });
    expect(mockUpdateSub).toHaveBeenCalledWith('sub_auto_789', { cancel_at_period_end: true });
  });

  it('returns error when Stripe update fails', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetStripeSubId.mockResolvedValue('sub_stripe_123');
    mockUpdateSub.mockRejectedValue(new Error('Stripe error'));
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'store' });
    expect(result).toEqual({ success: false, error: 'Failed to cancel subscription' });
  });
});

// ─── Bundle Cancel Tests ─────────────────────────────────────────────────────

describe('D3-S5: cancelSubscriptionAction — bundle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('cancels bundle: calls Stripe + sets cancelAtPeriodEnd + clears pending', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockSelect.mockReturnValue(selectChain([{ stripeSubscriptionId: 'sub_bundle_1' }]) as never);
    mockUpdate.mockReturnValue(updateChain() as never);
    mockUpdateSub.mockResolvedValue({} as never);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'bundle' });
    expect(result).toEqual({ success: true });
    expect(mockUpdateSub).toHaveBeenCalledWith('sub_bundle_1', { cancel_at_period_end: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns error when no active bundle subscription found', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockSelect.mockReturnValue(selectChain([]) as never);
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'bundle' });
    expect(result).toEqual({ success: false, error: 'No active subscription found' });
  });

  it('returns error when Stripe update fails for bundle', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockSelect.mockReturnValue(selectChain([{ stripeSubscriptionId: 'sub_bundle_1' }]) as never);
    mockUpdateSub.mockRejectedValue(new Error('Stripe error'));
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'bundle' });
    expect(result).toEqual({ success: false, error: 'Failed to cancel subscription' });
  });

  it('rejects bundle cancel when CASL denies', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(false), session: createSession() });
    const { cancelSubscriptionAction } = await import('../manage-subscription');
    const result = await cancelSubscriptionAction({ product: 'bundle' });
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' });
  });
});

// ─── Billing Portal Tests ────────────────────────────────────────────────────

describe('D3-S3: createBillingPortalSession', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: null });
    const { createBillingPortalSession } = await import('../manage-subscription');
    const result = await createBillingPortalSession();
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when no stripeCustomerId', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetSellerProfileId.mockResolvedValue('sp_123');
    setupMockProfileSelect(null);
    const { createBillingPortalSession } = await import('../manage-subscription');
    const result = await createBillingPortalSession();
    expect(result).toEqual({ success: false, error: 'No billing account found' });
  });

  it('creates portal session and returns URL', async () => {
    mockAuthorize.mockResolvedValue({ ability: createAbility(), session: createSession() });
    mockGetSellerProfileId.mockResolvedValue('sp_123');
    setupMockProfileSelect('cus_stripe_123');
    mockPortalCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/session_abc',
    } as never);
    const { createBillingPortalSession } = await import('../manage-subscription');
    const result = await createBillingPortalSession();
    expect(result.success).toBe(true);
    expect(result.portalUrl).toBe('https://billing.stripe.com/session_abc');
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_stripe_123' })
    );
  });
});

// ─── Shared Helpers ──────────────────────────────────────────────────────────

function setupMockProfileSelect(stripeCustomerId: string | null) {
  const profile = stripeCustomerId ? [{ stripeCustomerId }] : [{}];
  mockSelect.mockReturnValue(selectChain(profile) as never);
}
