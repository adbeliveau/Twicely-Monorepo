import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockDbSelect = vi.fn();
const mockStripeCreate = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: vi.fn((_type: string, conditions: unknown) => conditions),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
    insert: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    stripeAccountId: 'stripe_account_id',
    stripeOnboarded: 'stripe_onboarded',
    storeTier: 'store_tier',
    sellerType: 'seller_type',
    userId: 'user_id',
  },
  payout: {
    initiatedAt: 'initiated_at',
    userId: 'user_id',
    isOnDemand: 'is_on_demand',
  },
  auditEvent: {},
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    payouts: {
      create: mockStripeCreate,
      cancel: vi.fn(),
    },
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn(() => ({
    get: vi.fn().mockRejectedValue(new Error('Valkey unavailable')),
    set: vi.fn().mockResolvedValue('OK'),
  })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
  desc: vi.fn((_value: unknown) => 'desc'),
}));

function makeLimitChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

describe('requestPayoutAction security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockAuthorize.mockResolvedValue({
      session: { userId: 'seller-1', delegationId: null, onBehalfOfSellerId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });

    mockDbSelect
      .mockReturnValueOnce(makeLimitChain([
        {
          stripeAccountId: 'acct_123',
          stripeOnboarded: true,
          storeTier: 'PRO',
          sellerType: 'BUSINESS',
        },
      ]))
      .mockReturnValueOnce(makeLimitChain([
        { initiatedAt: new Date() },
      ]));
  });

  it('blocks repeated payouts even when Valkey is unavailable', async () => {
    const { requestPayoutAction } = await import('../payout-request');
    const result = await requestPayoutAction(5_000, false);

    expect(result).toEqual({
      success: false,
      error: 'You can only request one payout every 24 hours. Please try again later.',
    });
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });
});
