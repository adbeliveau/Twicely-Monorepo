import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ host: 'localhost:3000', 'x-forwarded-proto': 'https' })
  ),
}));

const mockAuthorize = vi.fn();
vi.mock('@twicely/casl', () => ({
  authorize: () => mockAuthorize(),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions, __caslSubjectType__: type,
  }),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerProfile: {
    id: 'id', listerTier: 'lister_tier', stripeCustomerId: 'stripe_customer_id',
  },
  platformSetting: { key: 'key', value: 'value' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
}));

const mockGetSellerProfileId = vi.fn();
vi.mock('@/lib/queries/subscriptions', () => ({
  getSellerProfileIdByUserId: (...args: unknown[]) => mockGetSellerProfileId(...args),
}));

const mockSetStripeCustomerId = vi.fn();
vi.mock('@/lib/mutations/subscriptions', () => ({
  setStripeCustomerId: (...args: unknown[]) => mockSetStripeCustomerId(...args),
}));

const mockStripeCustomersCreate = vi.fn();
const mockStripeCheckoutCreate = vi.fn();
vi.mock('@twicely/stripe/server', () => ({
  stripe: {
    customers: { create: (...args: unknown[]) => mockStripeCustomersCreate(...args) },
    checkout: { sessions: { create: (...args: unknown[]) => mockStripeCheckoutCreate(...args) } },
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockAuthSession(userId = 'user-test-201', email = 'test@example.com') {
  return {
    ability: { can: vi.fn(() => true) },
    session: {
      userId,
      email,
      delegationId: null,
      onBehalfOfSellerId: null,
    },
  };
}

function mockSellerProfile(listerTier: string, stripeCustomerId: string | null = 'cus-existing-001') {
  // First select: getSellerProfileIdByUserId (mocked separately)
  // Second select: load seller profile
  mockDbSelect
    .mockReturnValueOnce(makeSelectChain([{ listerTier, stripeCustomerId }]))  // profile by sellerProfileId
    .mockReturnValueOnce(makeSelectChain([{ value: '900' }]))   // priceCents setting
    .mockReturnValueOnce(makeSelectChain([{ value: '500' }])); // quantity setting
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('purchaseOveragePack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ─── Authentication ────────────────────────────────────────────────────────

  it('returns error when unauthenticated (session is null)', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) }, session: null });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  // ─── Input validation ──────────────────────────────────────────────────────

  it('returns error for invalid packType (Zod validation)', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack(
      { packType: 'invalid' as 'publishes' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns error for extra fields (strict schema)', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack(
      Object.assign({ packType: 'publishes' }, { extra: 'bad' }) as { packType: 'publishes' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  // ─── Seller profile not found ──────────────────────────────────────────────

  it('returns error when seller profile not found', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue(null);

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Seller profile not found');
  });

  // ─── Tier gates ───────────────────────────────────────────────────────────

  it('rejects FREE tier sellers from purchasing overage packs', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-201');
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ listerTier: 'FREE', stripeCustomerId: null }]));

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('LITE or PRO');
  });

  it('rejects NONE tier sellers from purchasing overage packs', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-202');
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ listerTier: 'NONE', stripeCustomerId: null }]));

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('LITE or PRO');
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  it('creates checkout session for LITE tier seller', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-203');
    mockSellerProfile('LITE', 'cus-existing-001');
    mockStripeCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/overage-session-1',
    });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(true);
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/overage-session-1');
  });

  it('creates checkout session for PRO tier seller', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-204');
    mockSellerProfile('PRO', 'cus-existing-002');
    mockStripeCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/overage-session-2',
    });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(true);
    expect(result.checkoutUrl).toContain('checkout.stripe.com');
  });

  it('creates Stripe checkout with mode: payment (not subscription)', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-205');
    mockSellerProfile('LITE', 'cus-existing-003');
    mockStripeCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session-mode-check',
    });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    await purchaseOveragePack({ packType: 'publishes' });

    const callArgs = mockStripeCheckoutCreate.mock.calls[0]![0];
    expect(callArgs.mode).toBe('payment');
  });

  it('includes metadata.type = overage_pack in checkout session', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession('user-test-206'));
    mockGetSellerProfileId.mockResolvedValue('sp-test-206');
    mockSellerProfile('LITE', 'cus-existing-004');
    mockStripeCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session-meta-check',
    });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    await purchaseOveragePack({ packType: 'publishes' });

    const callArgs = mockStripeCheckoutCreate.mock.calls[0]![0];
    expect(callArgs.metadata.type).toBe('overage_pack');
    expect(callArgs.metadata.userId).toBe('user-test-206');
  });

  it('reads price and quantity from platform_settings (not hardcoded)', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-207');
    // Return custom values from settings (different from 900/500 defaults)
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listerTier: 'LITE', stripeCustomerId: 'cus-existing-005' }]))
      .mockReturnValueOnce(makeSelectChain([{ value: '1200' }]))  // custom price: $12.00
      .mockReturnValueOnce(makeSelectChain([{ value: '750' }]));  // custom quantity: 750

    mockStripeCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session-settings-check',
    });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    await purchaseOveragePack({ packType: 'publishes' });

    const callArgs = mockStripeCheckoutCreate.mock.calls[0]![0];
    expect(callArgs.line_items[0].price_data.unit_amount).toBe(1200);
    expect(callArgs.metadata.quantity).toBe('750');
  });

  it('returns error when Stripe throws during checkout creation', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession());
    mockGetSellerProfileId.mockResolvedValue('sp-test-208');
    mockSellerProfile('LITE', 'cus-existing-006');
    mockStripeCheckoutCreate.mockRejectedValue(new Error('Stripe network error'));

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to create checkout');
  });

  it('creates Stripe customer when none exists and persists customer ID', async () => {
    mockAuthorize.mockResolvedValue(mockAuthSession('user-test-209', 'no-cus@example.com'));
    mockGetSellerProfileId.mockResolvedValue('sp-test-209');

    // Profile with no stripe customer
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ listerTier: 'LITE', stripeCustomerId: null }]))
      .mockReturnValueOnce(makeSelectChain([{ value: '900' }]))
      .mockReturnValueOnce(makeSelectChain([{ value: '500' }]));

    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus-new-001' });
    mockSetStripeCustomerId.mockResolvedValue(undefined);
    mockStripeCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/new-cus' });

    const { purchaseOveragePack } = await import('../purchase-overage-pack');
    const result = await purchaseOveragePack({ packType: 'publishes' });

    expect(mockStripeCustomersCreate).toHaveBeenCalledTimes(1);
    expect(mockSetStripeCustomerId).toHaveBeenCalledWith('sp-test-209', 'cus-new-001');
    expect(result.success).toBe(true);
  });
});
