import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockIsWebhookDuplicate = vi.fn().mockResolvedValue(false);
const mockMarkWebhookProcessed = vi.fn().mockResolvedValue(undefined);
const mockSyncAccountStatus = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', paymentIntentId: 'payment_intent_id', status: 'status', orderNumber: 'order_number', buyerId: 'buyer_id', sellerId: 'seller_id', totalCents: 'total_cents' },
  sellerProfile: { userId: 'user_id', stripeAccountId: 'stripe_account_id' },
  payout: { stripePayoutId: 'stripe_payout_id', status: 'status', failureReason: 'failure_reason', failedAt: 'failed_at', completedAt: 'completed_at', updatedAt: 'updated_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('../webhook-idempotency', () => ({
  isWebhookDuplicate: (...args: unknown[]) => mockIsWebhookDuplicate(...args),
  markWebhookProcessed: (...args: unknown[]) => mockMarkWebhookProcessed(...args),
}));

vi.mock('../connect', () => ({
  syncAccountStatus: (...args: unknown[]) => mockSyncAccountStatus(...args),
}));

vi.mock('../webhook-trial-handlers', () => ({
  handleTrialWillEnd: vi.fn().mockResolvedValue({ handled: true }),
  handleSubscriptionUpdated: vi.fn().mockResolvedValue({ handled: true }),
}));

vi.mock('../chargebacks', () => ({
  handleChargebackWebhook: vi.fn().mockResolvedValue({ success: true }),
  handleChargebackResolution: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../checkout-webhooks', () => ({
  handleCheckoutSessionCompleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../webhook-refund-handler', () => ({
  handleChargeRefunded: vi.fn().mockResolvedValue({ handled: true }),
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

// ─── Event builders ───────────────────────────────────────────────────────────

function makePayoutEvent(
  type: 'payout.paid' | 'payout.failed' | 'payout.canceled',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'evt_payout_test_001',
    type,
    account: 'acct_test_001',
    data: {
      object: {
        id: 'po_test_001',
        object: 'payout',
        amount: 5000,
        currency: 'usd',
        status: type.split('.')[1],
        failure_code: null,
        failure_message: null,
        ...overrides,
      },
    },
  };
}

const SELLER_USER_ID = 'seller-user-001';
const STRIPE_ACCOUNT_ID = 'acct_test_001';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleConnectWebhook — payout.paid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsWebhookDuplicate.mockResolvedValue(false);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
  });

  it('returns handled:true and notifies seller on payout.paid', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.paid');
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockNotify).toHaveBeenCalledWith(
      SELLER_USER_ID,
      'seller.payout.paid',
      expect.objectContaining({ amountFormatted: expect.stringContaining('50.00') }),
    );
  });

  it('updates payout record to COMPLETED on payout.paid', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.paid');
    await handleConnectWebhook(event as never);

    expect(mockDbUpdate).toHaveBeenCalled();
    const setCalls = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCalls?.status).toBe('COMPLETED');
    expect(setCalls?.completedAt).toBeInstanceOf(Date);
  });

  it('returns handled:true silently when seller not found on payout.paid', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.paid');
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns handled:true when stripeAccountId is missing on payout.paid', async () => {
    const { handleConnectWebhook } = await import('../webhooks');
    const event = { ...makePayoutEvent('payout.paid'), account: undefined };
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips duplicate payout.paid events (idempotency)', async () => {
    mockIsWebhookDuplicate.mockResolvedValue(true);

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.paid');
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('marks webhook processed after successful payout.paid handling', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.paid');
    await handleConnectWebhook(event as never);

    expect(mockMarkWebhookProcessed).toHaveBeenCalledWith(
      'evt_payout_test_001',
      'payout.paid',
      expect.any(Object),
    );
  });
});

describe('handleConnectWebhook — payout.failed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsWebhookDuplicate.mockResolvedValue(false);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
  });

  it('returns handled:true and notifies seller on payout.failed', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.failed', { failure_message: 'Insufficient funds' });
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockNotify).toHaveBeenCalledWith(
      SELLER_USER_ID,
      'seller.payout.failed',
      expect.objectContaining({
        amountFormatted: expect.stringContaining('50.00'),
        failureReason: 'Insufficient funds',
      }),
    );
  });

  it('updates payout record to FAILED with failureReason on payout.failed', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.failed', { failure_message: 'Bank declined' });
    await handleConnectWebhook(event as never);

    const setCalls = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCalls?.status).toBe('FAILED');
    expect(setCalls?.failureReason).toBe('Bank declined');
    expect(setCalls?.failedAt).toBeInstanceOf(Date);
  });

  it('uses default error message when failure_message is null', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.failed', { failure_message: null });
    await handleConnectWebhook(event as never);

    expect(mockNotify).toHaveBeenCalledWith(
      SELLER_USER_ID,
      'seller.payout.failed',
      expect.objectContaining({ failureReason: 'Unknown error — please check your bank account details.' }),
    );
  });

  it('returns handled:true silently when seller not found on payout.failed', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.failed');
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('returns handled:true when stripeAccountId is missing on payout.failed', async () => {
    const { handleConnectWebhook } = await import('../webhooks');
    const event = { ...makePayoutEvent('payout.failed'), account: undefined };
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});

describe('handleConnectWebhook — payout.canceled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsWebhookDuplicate.mockResolvedValue(false);
    mockDbUpdate.mockReturnValue(makeUpdateChain());
  });

  it('returns handled:true and notifies seller on payout.canceled', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.canceled');
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockNotify).toHaveBeenCalledWith(
      SELLER_USER_ID,
      'seller.payout.failed', // same template as failed per spec
      expect.objectContaining({
        amountFormatted: expect.stringContaining('50.00'),
        failureReason: expect.stringContaining('canceled'),
      }),
    );
  });

  it('updates payout record to FAILED with cancellation reason on payout.canceled', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ userId: SELLER_USER_ID }]));
    const updateChain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(updateChain);

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.canceled');
    await handleConnectWebhook(event as never);

    const setCalls = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCalls?.status).toBe('FAILED');
    expect(typeof setCalls?.failureReason).toBe('string');
    expect((setCalls?.failureReason as string).toLowerCase()).toContain('canceled');
  });

  it('returns handled:true silently when seller not found on payout.canceled', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { handleConnectWebhook } = await import('../webhooks');
    const event = makePayoutEvent('payout.canceled');
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('returns handled:true when stripeAccountId is missing on payout.canceled', async () => {
    const { handleConnectWebhook } = await import('../webhooks');
    const event = { ...makePayoutEvent('payout.canceled'), account: undefined };
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(true);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns handled:false for unknown connect event type', async () => {
    const { handleConnectWebhook } = await import('../webhooks');
    const event = { id: 'evt_unknown', type: 'unknown.event', account: STRIPE_ACCOUNT_ID, data: { object: {} } };
    const result = await handleConnectWebhook(event as never);

    expect(result.handled).toBe(false);
  });
});
