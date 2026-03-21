import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(
    new Headers({ host: 'localhost:3000', 'x-forwarded-proto': 'https' })
  ),
}));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: (type: string, conds: Record<string, unknown>) => ({ ...conds, __caslSubjectType__: type }),
}));
vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', hasAutomation: 'has_automation', listerTier: 'lister_tier', stripeCustomerId: 'stripe_customer_id' },
  automationSubscription: { sellerProfileId: 'seller_profile_id', status: 'status' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
}));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: () => Promise.resolve(1299),
}));
vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: vi.fn(),
}));
vi.mock('@/lib/mutations/subscriptions', () => ({
  setStripeCustomerId: vi.fn(),
}));
vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getSellerProfileIdByUserId } from '@/lib/queries/subscriptions';
import { stripe } from '@twicely/stripe/server';
import { purchaseAutomationAction } from '../purchase-automation';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockGetProfileId = vi.mocked(getSellerProfileIdByUserId);
const mockCreateSession = vi.mocked(stripe.checkout.sessions.create);

function mockSession(userId = 'user1') {
  return {
    ability: { can: vi.fn(() => true) } as never,
    session: { userId, email: 'test@example.com', isSeller: true } as never,
  };
}

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain as unknown as ReturnType<typeof db.select>;
}

beforeEach(() => {
  vi.resetAllMocks();
});

function setupEligibleSeller(overrides: { hasAutomation?: boolean; listerTier?: string; stripeCustomerId?: string | null } = {}) {
  const profile = {
    hasAutomation: false,
    listerTier: 'LITE',
    stripeCustomerId: 'cus_existing',
    ...overrides,
  };
  mockSelect
    .mockReturnValueOnce(makeChain([profile]))  // sellerProfile
    .mockReturnValueOnce(makeChain([]));         // automationSubscription (not active)
}

describe('purchaseAutomationAction', () => {
  it('creates Stripe checkout for eligible seller with LITE tier', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockGetProfileId.mockResolvedValue('sp1');
    setupEligibleSeller();
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/sess_123' } as never);

    const result = await purchaseAutomationAction({ billingCycle: 'monthly' });
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://checkout.stripe.com/sess_123');
  });

  it('creates Stripe checkout for eligible seller with PRO tier', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockGetProfileId.mockResolvedValue('sp1');
    setupEligibleSeller({ listerTier: 'PRO' });
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/sess_456' } as never);

    const result = await purchaseAutomationAction({ billingCycle: 'annual' });
    expect(result.success).toBe(true);
  });

  it('rejects seller with Lister FREE', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockGetProfileId.mockResolvedValue('sp1');
    setupEligibleSeller({ listerTier: 'FREE' });

    const result = await purchaseAutomationAction({ billingCycle: 'monthly' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Crosslister Lite');
  });

  it('rejects seller with Lister NONE', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockGetProfileId.mockResolvedValue('sp1');
    setupEligibleSeller({ listerTier: 'NONE' });

    const result = await purchaseAutomationAction({ billingCycle: 'monthly' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Crosslister Lite');
  });

  it('rejects seller who already has automation', async () => {
    mockAuthorize.mockResolvedValue(mockSession());
    mockGetProfileId.mockResolvedValue('sp1');
    setupEligibleSeller({ hasAutomation: true });

    const result = await purchaseAutomationAction({ billingCycle: 'monthly' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already subscribed');
  });

  it('returns error for unauthenticated user', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn() } as never, session: null });

    const result = await purchaseAutomationAction({ billingCycle: 'monthly' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('metadata includes product=automation, sellerProfileId, userId', async () => {
    mockAuthorize.mockResolvedValue(mockSession('user-abc'));
    mockGetProfileId.mockResolvedValue('sp-xyz');
    setupEligibleSeller();
    mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/sess_789' } as never);

    await purchaseAutomationAction({ billingCycle: 'monthly' });

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ product: 'automation', sellerProfileId: 'sp-xyz' }),
      })
    );
  });
});
