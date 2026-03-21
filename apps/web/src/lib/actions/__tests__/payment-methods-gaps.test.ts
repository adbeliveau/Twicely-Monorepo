/**
 * G10.10 — Payment methods server-action gap tests
 *
 * Covers branches NOT exercised by payment-methods.test.ts:
 *   - CASL Forbidden on all four actions
 *   - Missing stripeCustomerId on remove / setDefault
 *   - Stripe detach throws (removePaymentMethod catch path)
 *   - Stripe customers.update throws (setDefaultPaymentMethod catch path)
 *   - Zod validation edge cases (empty string, over-length ID)
 *   - Deleted Stripe customer in listPaymentMethods
 *   - listPaymentMethods: CASL Forbidden
 *   - createSetupIntent: Stripe throws
 *   - serializePaymentMethod: null card fields (via listPaymentMethods)
 *   - listPaymentMethods: default_payment_method is a PM object (not a string)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockAuthorize = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));

vi.mock('@twicely/db/schema', () => ({
  user: {
    id: 'id',
    stripeCustomerId: 'stripe_customer_id',
    email: 'email',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockStripe = {
  paymentMethods: {
    list: vi.fn(),
    retrieve: vi.fn(),
    detach: vi.fn(),
  },
  customers: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  setupIntents: {
    create: vi.fn(),
  },
};

vi.mock('@twicely/stripe/server', () => ({
  stripe: mockStripe,
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate },
}));

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


function makeSession(userId = 'user-test-1', email = 'user@example.com') {
  return {
    session: { userId, email },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeForbiddenSession(userId = 'user-test-1', email = 'user@example.com') {
  return {
    session: { userId, email },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

function makeStripePaymentMethod(overrides: Partial<{ id: string; customer: string; card: unknown }> = {}) {
  return {
    id: overrides.id ?? 'pm_test_1',
    object: 'payment_method',
    customer: overrides.customer ?? 'cus_test_1',
    card: overrides.card !== undefined ? overrides.card : {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2028,
    },
  };
}

// ─── listPaymentMethods — CASL forbidden ──────────────────────────────────────

describe('listPaymentMethods — CASL forbidden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns success:false with Forbidden when ability.can returns false', async () => {
    mockAuthorize.mockResolvedValue(makeForbiddenSession());

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
    expect(result.paymentMethods).toHaveLength(0);
  });
});

// ─── listPaymentMethods — deleted Stripe customer ────────────────────────────

describe('listPaymentMethods — deleted Stripe customer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty list when Stripe customer is deleted', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_deleted' }]));

    mockStripe.paymentMethods.list.mockResolvedValue({ data: [] });
    mockStripe.customers.retrieve.mockResolvedValue({ id: 'cus_deleted', deleted: true });

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(true);
    expect(result.paymentMethods).toHaveLength(0);
    expect(result.defaultPaymentMethodId).toBeNull();
  });
});

// ─── listPaymentMethods — default_payment_method is a PM object ───────────────

describe('listPaymentMethods — default_payment_method as PM object', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('extracts defaultPaymentMethodId from the object .id when not a string', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_test_1' }]));

    const pm = makeStripePaymentMethod({ id: 'pm_obj_1', customer: 'cus_test_1' });
    mockStripe.paymentMethods.list.mockResolvedValue({ data: [pm] });
    // Stripe sometimes returns an expanded PaymentMethod object instead of a string ID
    mockStripe.customers.retrieve.mockResolvedValue({
      id: 'cus_test_1',
      deleted: false,
      invoice_settings: {
        default_payment_method: { id: 'pm_obj_1', object: 'payment_method' },
      },
    });

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(true);
    expect(result.defaultPaymentMethodId).toBe('pm_obj_1');
    expect(result.paymentMethods[0]?.isDefault).toBe(true);
  });
});

// ─── listPaymentMethods — null card fields in serializePaymentMethod ──────────

describe('listPaymentMethods — null card fields fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses fallback values when pm.card is undefined', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_test_1' }]));

    // Construct PM inline so card is truly absent (not overriding with undefined via spread)
    const pmNoCard = { id: 'pm_nocard', object: 'payment_method', customer: 'cus_test_1' };
    mockStripe.paymentMethods.list.mockResolvedValue({ data: [pmNoCard] });
    mockStripe.customers.retrieve.mockResolvedValue({
      id: 'cus_test_1',
      deleted: false,
      invoice_settings: { default_payment_method: null },
    });

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(true);
    expect(result.paymentMethods[0]?.brand).toBe('unknown');
    expect(result.paymentMethods[0]?.last4).toBe('????');
    expect(result.paymentMethods[0]?.expMonth).toBe(0);
    expect(result.paymentMethods[0]?.expYear).toBe(0);
  });
});

// ─── createSetupIntent — CASL forbidden ──────────────────────────────────────

describe('createSetupIntent — CASL forbidden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockAuthorize.mockResolvedValue(makeForbiddenSession());

    const { createSetupIntent } = await import('../payment-methods');
    const result = await createSetupIntent();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── createSetupIntent — Stripe setupIntents.create throws ───────────────────

describe('createSetupIntent — Stripe error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns success:false with error message when Stripe throws', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-2', 'err@example.com'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_err_test' }]));

    mockStripe.setupIntents.create.mockRejectedValue(new Error('Stripe rate limit'));

    const { createSetupIntent } = await import('../payment-methods');
    const result = await createSetupIntent();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Stripe rate limit/);
    expect(result.clientSecret).toBeUndefined();
  });
});

// ─── removePaymentMethod — CASL forbidden ────────────────────────────────────

describe('removePaymentMethod — CASL forbidden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockAuthorize.mockResolvedValue(makeForbiddenSession());

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
    expect(mockStripe.paymentMethods.retrieve).not.toHaveBeenCalled();
  });
});

// ─── removePaymentMethod — missing stripeCustomerId ──────────────────────────

describe('removePaymentMethod — no Stripe customer on file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when user has no stripeCustomerId', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-3'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: null }]));

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No payment methods on file');
    expect(mockStripe.paymentMethods.retrieve).not.toHaveBeenCalled();
  });

  it('returns error when DB returns empty row (user not found)', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-4'));
    // DB returns empty array — userRow is undefined
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No payment methods on file');
  });
});

// ─── removePaymentMethod — Zod validation ────────────────────────────────────

describe('removePaymentMethod — Zod validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects empty string paymentMethodId', async () => {
    mockAuthorize.mockResolvedValue(makeSession());

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid payment method ID');
  });

  it('rejects paymentMethodId over 100 characters', async () => {
    mockAuthorize.mockResolvedValue(makeSession());

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('a'.repeat(101));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid payment method ID');
  });
});

// ─── removePaymentMethod — Stripe detach throws ──────────────────────────────

describe('removePaymentMethod — Stripe detach error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns success:false with error message when detach throws', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-5'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_test_5' }]));

    mockStripe.paymentMethods.retrieve.mockResolvedValue(
      makeStripePaymentMethod({ id: 'pm_detach_err', customer: 'cus_test_5' }),
    );
    mockStripe.paymentMethods.detach.mockRejectedValue(new Error('Card already removed'));

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_detach_err');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Card already removed/);
  });
});

// ─── setDefaultPaymentMethod — CASL forbidden ────────────────────────────────

describe('setDefaultPaymentMethod — CASL forbidden', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when ability.can returns false', async () => {
    mockAuthorize.mockResolvedValue(makeForbiddenSession());

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
    expect(mockStripe.paymentMethods.retrieve).not.toHaveBeenCalled();
  });
});

// ─── setDefaultPaymentMethod — missing stripeCustomerId ──────────────────────

describe('setDefaultPaymentMethod — no Stripe customer on file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when user has no stripeCustomerId', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-6'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: null }]));

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No payment methods on file');
    expect(mockStripe.paymentMethods.retrieve).not.toHaveBeenCalled();
  });

  it('returns error when DB returns empty row', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-7'));
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('No payment methods on file');
  });
});

// ─── setDefaultPaymentMethod — Zod validation ────────────────────────────────

describe('setDefaultPaymentMethod — Zod validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects empty string paymentMethodId', async () => {
    mockAuthorize.mockResolvedValue(makeSession());

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid payment method ID');
  });

  it('rejects paymentMethodId over 100 characters', async () => {
    mockAuthorize.mockResolvedValue(makeSession());

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('x'.repeat(101));

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid payment method ID');
  });
});

// ─── setDefaultPaymentMethod — Stripe customers.update throws ────────────────

describe('setDefaultPaymentMethod — Stripe update error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns success:false with error message when customers.update throws', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-test-8'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_test_8' }]));

    mockStripe.paymentMethods.retrieve.mockResolvedValue(
      makeStripePaymentMethod({ id: 'pm_update_err', customer: 'cus_test_8' }),
    );
    mockStripe.customers.update.mockRejectedValue(new Error('Customer update failed'));

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_update_err');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Customer update failed/);
  });
});
