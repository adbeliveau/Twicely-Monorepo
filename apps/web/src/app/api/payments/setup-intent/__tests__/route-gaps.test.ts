/**
 * G10.10 — /api/payments/setup-intent route gap tests
 *
 * Covers branches NOT exercised by route.test.ts:
 *   - 403 Forbidden when ability.can('update') returns false
 *   - getOrCreateStripeCustomer creates a new Stripe customer when none exists
 *   - DB update is called after creating new Stripe customer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mocks referenced inside vi.mock factories ─────────────────────────

const { mockDbSelect, mockDbUpdate, mockStripeSetupIntentsCreate, mockStripeCustomersCreate } =
  vi.hoisted(() => ({
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockStripeSetupIntentsCreate: vi.fn(),
    mockStripeCustomersCreate: vi.fn(),
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
    customers: { create: mockStripeCustomersCreate },
    setupIntents: { create: mockStripeSetupIntentsCreate },
  },
}));

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
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

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/payments/setup-intent — gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when ability.can returns false', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-1', email: 'user@example.com' },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const res = await POST();
    expect(res.status).toBe(403);

    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Forbidden');
  });

  it('creates Stripe customer and saves to DB when no stripeCustomerId exists', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-2', email: 'new@example.com' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });

    // DB returns no existing customer
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: null }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_newly_created' });
    mockStripeSetupIntentsCreate.mockResolvedValue({ client_secret: 'seti_new_secret' });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json() as { success: boolean; clientSecret: string };
    expect(body.success).toBe(true);
    expect(body.clientSecret).toBe('seti_new_secret');

    // Stripe customer should have been created with correct metadata
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: 'new@example.com',
      metadata: { userId: 'user-test-2', platform: 'twicely' },
    });

    // DB update should have persisted the new customer ID
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('does not create Stripe customer when stripeCustomerId already exists', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-3', email: 'existing@example.com' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });

    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_existing_1' }]));
    mockStripeSetupIntentsCreate.mockResolvedValue({ client_secret: 'seti_existing_secret' });

    const res = await POST();
    expect(res.status).toBe(200);

    expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();

    const body = await res.json() as { success: boolean; clientSecret: string };
    expect(body.success).toBe(true);
    expect(body.clientSecret).toBe('seti_existing_secret');
  });
});
