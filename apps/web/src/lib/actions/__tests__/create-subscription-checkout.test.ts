import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({
      host: 'localhost:3000',
      'x-forwarded-proto': 'https',
    })
  ),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockSubTable = { sellerProfileId: 'seller_profile_id', status: 'status' };
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', sellerType: 'seller_type', stripeAccountId: 'stripe_account_id',
    stripeOnboarded: 'stripe_onboarded', stripeCustomerId: 'stripe_customer_id',
    storeTier: 'store_tier', listerTier: 'lister_tier', financeTier: 'finance_tier', hasAutomation: 'has_automation' },
  storeSubscription: mockSubTable, listerSubscription: mockSubTable,
  automationSubscription: mockSubTable, financeSubscription: mockSubTable,
  identityVerification: { id: 'id', userId: 'user_id', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
}));

vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn(),
}));

vi.mock('@twicely/subscriptions/price-map', () => ({
  getStripePriceId: vi.fn(),
}));

vi.mock('@twicely/subscriptions/subscription-engine', () => ({
  canSubscribeToStoreTier: vi.fn(),
  isPaidStoreTier: vi.fn(),
  isPaidListerTier: vi.fn(),
}));

vi.mock('@/lib/mutations/subscriptions', () => ({
  setStripeCustomerId: vi.fn(),
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { getStripePriceId } from '@twicely/subscriptions/price-map';
import {
  canSubscribeToStoreTier,
  isPaidStoreTier,
  isPaidListerTier,
} from '@twicely/subscriptions/subscription-engine';
import { setStripeCustomerId } from '@/lib/mutations/subscriptions';
import { stripe } from '@twicely/stripe/server';
import {
  createMockCheckoutSession,
} from '@/lib/__tests__/helpers/stripe-mocks';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockGetSellerProfileId = vi.mocked(getSellerProfileIdByUserId);
const mockGetStripePriceId = vi.mocked(getStripePriceId);
const mockCanSubscribeToStoreTier = vi.mocked(canSubscribeToStoreTier);
const mockIsPaidStoreTier = vi.mocked(isPaidStoreTier);
const mockIsPaidListerTier = vi.mocked(isPaidListerTier);
const mockCreateCheckoutSession = vi.mocked(stripe.checkout.sessions.create);

// Suppress unused imports warning - these are needed for mocking setup
void setStripeCustomerId;
void stripe.customers.create;

function mockCaslSession(userId = 'user_123', email = 'test@example.com', sellerId: string | null = 'sp_123') {
  return {
    ability: { can: vi.fn(() => true) } as never,
    session: { userId, email, isSeller: true, sellerId, sellerStatus: null,
      delegationId: null, onBehalfOfSellerId: null, onBehalfOfSellerProfileId: null, delegatedScopes: [],
      isPlatformStaff: false, platformRoles: [] } as never,
  };
}

describe('D3-S2: createSubscriptionCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth/eligibility checks', () => {
    it('returns error when user is not authenticated', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: null });

      const result = await createSubscriptionCheckout({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('returns error when seller profile is not found', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue(null);

      const result = await createSubscriptionCheckout({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Seller profile not found');
    });

    it('returns error when store subscription without BUSINESS status', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue('sp_123');
      setupMockProfile({ sellerType: 'PERSONAL' });
      mockCanSubscribeToStoreTier.mockReturnValue({
        allowed: false,
        reason: 'Store subscriptions require a business seller account',
      });

      const result = await createSubscriptionCheckout({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('business');
    });

    it('returns error when already has active subscription', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue('sp_123');
      setupMockProfile({ sellerType: 'BUSINESS', hasActiveStoreSub: true });
      mockCanSubscribeToStoreTier.mockReturnValue({ allowed: true });
      mockIsPaidStoreTier.mockReturnValue(true);
      mockGetStripePriceId.mockReturnValue('price_store_pro_monthly');

      const result = await createSubscriptionCheckout({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('upgrade/downgrade');
    });
  });

  describe('Checkout creation', () => {
    it('creates checkout session for valid store PRO monthly', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue('sp_123');
      // Use existing stripe customer to avoid needing to mock customer creation
      setupMockProfile({ sellerType: 'BUSINESS', stripeCustomerId: 'cus_existing' });
      mockCanSubscribeToStoreTier.mockReturnValue({ allowed: true });
      mockIsPaidStoreTier.mockReturnValue(true);
      mockGetStripePriceId.mockReturnValue('price_store_pro_monthly');
      mockCreateCheckoutSession.mockResolvedValue(createMockCheckoutSession('https://checkout.stripe.com/session_123'));

      const result = await createSubscriptionCheckout({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session_123');
    });

    it('creates checkout session for valid lister LITE annual', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue('sp_123');
      // Use existing stripe customer to avoid needing to mock customer creation
      setupMockProfile({ sellerType: 'PERSONAL', stripeCustomerId: 'cus_existing' });
      mockIsPaidListerTier.mockReturnValue(true);
      mockGetStripePriceId.mockReturnValue('price_crosslister_lite_annual');
      mockCreateCheckoutSession.mockResolvedValue(createMockCheckoutSession('https://checkout.stripe.com/session_456'));

      const result = await createSubscriptionCheckout({
        product: 'lister',
        tier: 'LITE',
        interval: 'annual',
      });

      expect(result.success).toBe(true);
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session_456');
    });

    it('returns error for invalid tier (store NONE)', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue('sp_123');
      setupMockProfile({ sellerType: 'BUSINESS' });
      mockCanSubscribeToStoreTier.mockReturnValue({ allowed: true });
      mockIsPaidStoreTier.mockReturnValue(false); // NONE is not a paid tier

      const result = await createSubscriptionCheckout({
        product: 'store',
        tier: 'NONE',
        interval: 'monthly',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid tier');
    });

    it('includes sellerProfileId and product in subscription_data metadata', async () => {
      const { createSubscriptionCheckout } = await import('../create-subscription-checkout');

      mockAuthorize.mockResolvedValue(mockCaslSession());
      mockGetSellerProfileId.mockResolvedValue('sp_123');
      setupMockProfile({ sellerType: 'BUSINESS', stripeCustomerId: 'cus_existing' });
      mockCanSubscribeToStoreTier.mockReturnValue({ allowed: true });
      mockIsPaidStoreTier.mockReturnValue(true);
      mockGetStripePriceId.mockReturnValue('price_store_pro_monthly');
      mockCreateCheckoutSession.mockResolvedValue(createMockCheckoutSession('https://checkout.stripe.com/session_789'));

      await createSubscriptionCheckout({
        product: 'store',
        tier: 'PRO',
        interval: 'monthly',
      });

      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            metadata: expect.objectContaining({
              sellerProfileId: 'sp_123',
              product: 'store',
              tier: 'PRO',
            }),
          }),
        })
      );
    });
  });
});

// ─── Test Helpers ───────────────────────────────────────────────────────────

interface MockProfileOptions { sellerType?: 'PERSONAL' | 'BUSINESS'; stripeCustomerId?: string | null; hasActiveStoreSub?: boolean; hasIdentityVerified?: boolean; }

function setupMockProfile(opts: MockProfileOptions = {}) {
  const profile = { sellerType: opts.sellerType || 'PERSONAL', stripeAccountId: 'acct_123',
    stripeOnboarded: true, stripeCustomerId: opts.stripeCustomerId || null,
    storeTier: 'NONE', listerTier: 'FREE', financeTier: 'FREE', hasAutomation: false };
  const chain = (data: unknown[]) => ({ from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(data) }) }) });
  let callCount = 0;
  mockSelect.mockImplementation(() => {
    callCount++;
    // Call 1: seller profile, Call 2: identity verification (store only), Call 3: active subscription check
    if (callCount === 1) return chain([profile]) as unknown as ReturnType<typeof db.select>;
    if (callCount === 2) return chain(opts.hasIdentityVerified !== false ? [{ status: 'VERIFIED' }] : []) as unknown as ReturnType<typeof db.select>;
    return chain(opts.hasActiveStoreSub ? [{ status: 'ACTIVE' }] : []) as unknown as ReturnType<typeof db.select>;
  });
}
