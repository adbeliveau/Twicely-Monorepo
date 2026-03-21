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
    select: vi.fn(),
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

function makeSession(userId = 'user-1', email = 'user@example.com') {
  return {
    session: { userId, email },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeStripePaymentMethod(overrides: Partial<{ id: string; customer: string }> = {}) {
  return {
    id: overrides.id ?? 'pm_test_1',
    object: 'payment_method',
    customer: overrides.customer ?? 'cus_test_1',
    card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2028 },
  };
}

function makeStripeCustomer(defaultPmId: string | null = null) {
  return {
    id: 'cus_test_1',
    deleted: false,
    invoice_settings: { default_payment_method: defaultPmId },
  };
}

// ─── listPaymentMethods ───────────────────────────────────────────────────────

describe('listPaymentMethods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(false);
    expect(result.paymentMethods).toHaveLength(0);
  });

  it('returns empty array when user has no stripeCustomerId', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: null }]));

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(true);
    expect(result.paymentMethods).toHaveLength(0);
    expect(result.defaultPaymentMethodId).toBeNull();
  });

  it('returns serialized list when user has saved cards', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_test_1' }]));

    const pm = makeStripePaymentMethod();
    mockStripe.paymentMethods.list.mockResolvedValue({ data: [pm] });
    mockStripe.customers.retrieve.mockResolvedValue(makeStripeCustomer('pm_test_1'));

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(true);
    expect(result.paymentMethods).toHaveLength(1);
    expect(result.paymentMethods[0]?.last4).toBe('4242');
    expect(result.paymentMethods[0]?.isDefault).toBe(true);
  });

  it('returns success:false when Stripe API throws', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_test_1' }]));

    mockStripe.paymentMethods.list.mockRejectedValue(new Error('Stripe error'));
    mockStripe.customers.retrieve.mockResolvedValue(makeStripeCustomer());

    const { listPaymentMethods } = await import('../payment-methods');
    const result = await listPaymentMethods();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Stripe error/);
  });
});

// ─── createSetupIntent ────────────────────────────────────────────────────────

describe('createSetupIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when not logged in', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { createSetupIntent } = await import('../payment-methods');
    const result = await createSetupIntent();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('creates Stripe Customer and SetupIntent when no existing customer', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-2', 'new@example.com'));
    // First select returns no stripeCustomerId
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: null }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' });
    mockStripe.setupIntents.create.mockResolvedValue({
      client_secret: 'seti_secret_123',
    });

    const { createSetupIntent } = await import('../payment-methods');
    const result = await createSetupIntent();

    expect(result.success).toBe(true);
    expect(result.clientSecret).toBe('seti_secret_123');
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      metadata: { userId: 'user-2', platform: 'twicely' },
    });
  });

  it('skips Customer creation and creates SetupIntent when customer exists', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-3', 'existing@example.com'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_existing' }]));

    mockStripe.setupIntents.create.mockResolvedValue({
      client_secret: 'seti_secret_456',
    });

    const { createSetupIntent } = await import('../payment-methods');
    const result = await createSetupIntent();

    expect(result.success).toBe(true);
    expect(result.clientSecret).toBe('seti_secret_456');
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
  });
});

// ─── removePaymentMethod ──────────────────────────────────────────────────────

describe('removePaymentMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns forbidden when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns not found when PM belongs to a different customer (IDOR guard)', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-4'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_user4' }]));

    // PM returned by Stripe belongs to a different customer
    mockStripe.paymentMethods.retrieve.mockResolvedValue(
      makeStripePaymentMethod({ id: 'pm_other', customer: 'cus_other' }),
    );

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_other');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment method not found');
    expect(mockStripe.paymentMethods.detach).not.toHaveBeenCalled();
  });

  it('detaches PM and returns success when user owns it', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-5'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_user5' }]));

    mockStripe.paymentMethods.retrieve.mockResolvedValue(
      makeStripePaymentMethod({ id: 'pm_mine', customer: 'cus_user5' }),
    );
    mockStripe.paymentMethods.detach.mockResolvedValue({ id: 'pm_mine' });

    const { removePaymentMethod } = await import('../payment-methods');
    const result = await removePaymentMethod('pm_mine');

    expect(result.success).toBe(true);
    expect(mockStripe.paymentMethods.detach).toHaveBeenCalledWith('pm_mine');
  });
});

// ─── setDefaultPaymentMethod ──────────────────────────────────────────────────

describe('setDefaultPaymentMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns forbidden when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_test_1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns not found when PM belongs to a different customer (IDOR guard)', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-6'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_user6' }]));

    mockStripe.paymentMethods.retrieve.mockResolvedValue(
      makeStripePaymentMethod({ id: 'pm_other', customer: 'cus_other_user' }),
    );

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_other');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment method not found');
    expect(mockStripe.customers.update).not.toHaveBeenCalled();
  });

  it('updates customer default PM and returns success when user owns it', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-7'));
    mockDbSelect.mockReturnValue(makeSelectChain([{ stripeCustomerId: 'cus_user7' }]));

    mockStripe.paymentMethods.retrieve.mockResolvedValue(
      makeStripePaymentMethod({ id: 'pm_mine', customer: 'cus_user7' }),
    );
    mockStripe.customers.update.mockResolvedValue({ id: 'cus_user7' });

    const { setDefaultPaymentMethod } = await import('../payment-methods');
    const result = await setDefaultPaymentMethod('pm_mine');

    expect(result.success).toBe(true);
    expect(mockStripe.customers.update).toHaveBeenCalledWith('cus_user7', {
      invoice_settings: { default_payment_method: 'pm_mine' },
    });
  });
});
