import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockDbSelect = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { id: 'id', userId: 'user_id' },
  listerSubscription: {
    id: 'id', sellerProfileId: 'seller_profile_id',
    currentPeriodEnd: 'current_period_end', tier: 'tier', status: 'status',
  },
  publishCreditLedger: {
    id: 'id', userId: 'user_id', creditType: 'credit_type',
    totalCredits: 'total_credits', createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  gte: vi.fn((a, b) => ({ type: 'gte', a, b })),
}));

const mockAddOverageCredits = vi.fn();
vi.mock('@twicely/crosslister/services/rollover-manager', () => ({
  addOverageCredits: (...args: unknown[]) => mockAddOverageCredits(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

// ─── Session builders ─────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_001',
    metadata: {
      type: 'overage_pack',
      packType: 'publishes',
      userId: 'user-test-301',
      quantity: '500',
      ...overrides,
    },
  } as unknown as import('stripe').default.Checkout.Session;
}

const PERIOD_END = new Date('2025-07-01T00:00:00Z');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleCheckoutSessionCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('delivers overage credits when all metadata is valid and subscription is ACTIVE', async () => {
    const session = makeSession();

    // 1st select: find lister subscription → ACTIVE
    // 2nd select: idempotency check → no existing
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{
        currentPeriodEnd: PERIOD_END,
        tier: 'LITE',
        status: 'ACTIVE',
      }]))
      .mockReturnValueOnce(makeSelectChain([])); // no existing overage within 60s

    mockAddOverageCredits.mockResolvedValue(undefined);

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await handleCheckoutSessionCompleted(session);

    expect(mockAddOverageCredits).toHaveBeenCalledTimes(1);
    expect(mockAddOverageCredits).toHaveBeenCalledWith(
      'user-test-301',
      500,
      PERIOD_END,
    );
  });

  it('skips credits when metadata fields are missing', async () => {
    const session = makeSession({ userId: undefined });

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await handleCheckoutSessionCompleted(session);

    expect(mockAddOverageCredits).not.toHaveBeenCalled();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('handles unknown session type without crashing', async () => {
    const session = makeSession({ type: 'unknown_type_xyz' } as Record<string, unknown>);

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await expect(handleCheckoutSessionCompleted(session)).resolves.toBeUndefined();

    expect(mockAddOverageCredits).not.toHaveBeenCalled();
  });

  it('logs error and skips credits when no active lister subscription found', async () => {
    const session = makeSession();

    mockDbSelect.mockReturnValueOnce(makeSelectChain([])); // no subscription row

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await handleCheckoutSessionCompleted(session);

    expect(mockAddOverageCredits).not.toHaveBeenCalled();
  });

  it('skips credits on duplicate webhook (existing OVERAGE within 60s)', async () => {
    const session = makeSession();

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{
        currentPeriodEnd: PERIOD_END,
        tier: 'LITE',
        status: 'ACTIVE',
      }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'pcl-existing-001' }])); // duplicate found

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await handleCheckoutSessionCompleted(session);

    expect(mockAddOverageCredits).not.toHaveBeenCalled();
  });

  it('skips credits when subscription status is not ACTIVE or TRIALING', async () => {
    const session = makeSession();

    mockDbSelect.mockReturnValueOnce(makeSelectChain([{
      currentPeriodEnd: PERIOD_END,
      tier: 'LITE',
      status: 'PAST_DUE', // not ACTIVE/TRIALING
    }]));

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await handleCheckoutSessionCompleted(session);

    expect(mockAddOverageCredits).not.toHaveBeenCalled();
  });

  it('delivers credits when subscription status is TRIALING', async () => {
    const session = makeSession();

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{
        currentPeriodEnd: PERIOD_END,
        tier: 'LITE',
        status: 'TRIALING',
      }]))
      .mockReturnValueOnce(makeSelectChain([]));

    mockAddOverageCredits.mockResolvedValue(undefined);

    const { handleCheckoutSessionCompleted } = await import('../checkout-webhooks');
    await handleCheckoutSessionCompleted(session);

    expect(mockAddOverageCredits).toHaveBeenCalledTimes(1);
  });
});
