import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mocks that are referenced in vi.mock factories ────────────────────

const { mockDbSelect, mockStripeSetupIntentsCreate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockStripeSetupIntentsCreate: vi.fn(),
}));

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockAuthorize = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (...args: unknown[]) => args,
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', stripeCustomerId: 'stripe_customer_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    customers: { create: vi.fn() },
    setupIntents: { create: mockStripeSetupIntentsCreate },
  },
}));

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: vi.fn() },
}));

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) }),
}));

// ─── Import route after mocks ─────────────────────────────────────────────────

import { POST } from '../route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/payments/setup-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when session is null', async () => {
    mockAuthorize.mockResolvedValue({
      session: null,
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const res = await POST();
    expect(res.status).toBe(401);

    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns clientSecret when authenticated', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', email: 'user@example.com' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });

    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_existing' }]));
    mockStripeSetupIntentsCreate.mockResolvedValue({ client_secret: 'seti_test_secret' });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json() as { success: boolean; clientSecret: string };
    expect(body.success).toBe(true);
    expect(body.clientSecret).toBe('seti_test_secret');
  });

  it('returns 500 when Stripe throws an error', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-2', email: 'user2@example.com' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });

    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_user2' }]));
    mockStripeSetupIntentsCreate.mockRejectedValue(new Error('Stripe API error'));

    const res = await POST();
    expect(res.status).toBe(500);

    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to create setup intent');
  });
});
