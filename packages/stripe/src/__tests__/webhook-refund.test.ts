import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn().mockReturnValue({ set: vi.fn().mockResolvedValue('OK') }),
}));

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id', status: 'status', orderNumber: 'order_number',
    buyerId: 'buyer_id', sellerId: 'seller_id', paymentIntentId: 'payment_intent_id',
  },
  ledgerEntry: { id: 'id', type: 'type' },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn((col, val) => ({ col, val })),
}));

const mockNotify = vi.fn();
vi.mock('@twicely/notifications/service', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@twicely/stripe/connect', () => ({
  syncAccountStatus: vi.fn(),
}));

vi.mock('@twicely/stripe/webhook-trial-handlers', () => ({
  handleTrialWillEnd: vi.fn(),
  handleSubscriptionUpdated: vi.fn(),
}));

vi.mock('@twicely/stripe/chargebacks', () => ({
  handleChargebackWebhook: vi.fn(),
  handleChargebackResolution: vi.fn(),
}));

vi.mock('@twicely/stripe/checkout-webhooks', () => ({
  handleCheckoutSessionCompleted: vi.fn(),
}));

// ─── Chain helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

// ─── Charge builders ──────────────────────────────────────────────────────────

function makeCharge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch_test_001',
    payment_intent: 'pi_test_001',
    amount: 5000,
    amount_refunded: 5000,
    ...overrides,
  } as unknown as import('stripe').default.Charge;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handlePlatformWebhook — charge.refunded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('handles full refund — updates order to REFUNDED', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: 'ord-1',
      status: 'DELIVERED',
      orderNumber: 'TW-1001',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
    }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockNotify.mockResolvedValue(undefined);

    const { handlePlatformWebhook } = await import('../webhooks');
    const result = await handlePlatformWebhook({
      type: 'charge.refunded',
      data: { object: makeCharge({ amount: 5000, amount_refunded: 5000 }) },
    } as unknown as import('stripe').default.Event);

    expect(result).toEqual({ handled: true });
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);

    const setCall = mockDbUpdate.mock.results[0]!.value.set.mock.calls[0]![0];
    expect(setCall.status).toBe('REFUNDED');
  });

  it('handles partial refund — does not change order status', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: 'ord-2',
      status: 'DELIVERED',
      orderNumber: 'TW-1002',
      buyerId: 'buyer-2',
      sellerId: 'seller-2',
    }]));
    mockDbInsert.mockReturnValue(makeInsertChain());

    const { handlePlatformWebhook } = await import('../webhooks');
    const result = await handlePlatformWebhook({
      type: 'charge.refunded',
      data: { object: makeCharge({ amount: 5000, amount_refunded: 2000 }) },
    } as unknown as import('stripe').default.Event);

    expect(result).toEqual({ handled: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();

    // Ledger entry is still written for partial refund
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const insertValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(insertValues.type).toBe('REFUND_PARTIAL');
    expect(insertValues.amountCents).toBe(-2000);
  });

  it('skips if order already REFUNDED', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: 'ord-3',
      status: 'REFUNDED',
      orderNumber: 'TW-1003',
      buyerId: 'buyer-3',
      sellerId: 'seller-3',
    }]));

    const { handlePlatformWebhook } = await import('../webhooks');
    const result = await handlePlatformWebhook({
      type: 'charge.refunded',
      data: { object: makeCharge() },
    } as unknown as import('stripe').default.Event);

    expect(result).toEqual({ handled: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('skips if no order found for payment intent', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { handlePlatformWebhook } = await import('../webhooks');
    const result = await handlePlatformWebhook({
      type: 'charge.refunded',
      data: { object: makeCharge() },
    } as unknown as import('stripe').default.Event);

    expect(result).toEqual({ handled: true });
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('notifies buyer on full refund', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: 'ord-4',
      status: 'DELIVERED',
      orderNumber: 'TW-1004',
      buyerId: 'buyer-4',
      sellerId: 'seller-4',
    }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
    mockNotify.mockResolvedValue(undefined);

    const { handlePlatformWebhook } = await import('../webhooks');
    await handlePlatformWebhook({
      type: 'charge.refunded',
      data: { object: makeCharge({ amount: 5000, amount_refunded: 5000 }) },
    } as unknown as import('stripe').default.Event);

    expect(mockNotify).toHaveBeenCalledWith(
      'buyer-4',
      'order.refunded',
      expect.objectContaining({ orderNumber: 'TW-1004', refundAmountFormatted: '$50.00' }),
    );
    expect(mockNotify).toHaveBeenCalledWith(
      'seller-4',
      'order.refunded',
      expect.objectContaining({ orderNumber: 'TW-1004', refundAmountFormatted: '$50.00' }),
    );
    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  it('logs error on failure and returns handled: false', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{
      id: 'ord-5',
      status: 'DELIVERED',
      orderNumber: 'TW-1005',
      buyerId: 'buyer-5',
      sellerId: 'seller-5',
    }]));
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      }),
    });

    const { handlePlatformWebhook } = await import('../webhooks');
    const result = await handlePlatformWebhook({
      type: 'charge.refunded',
      data: { object: makeCharge({ amount: 5000, amount_refunded: 5000 }) },
    } as unknown as import('stripe').default.Event);

    expect(result).toEqual({ handled: false, error: 'DB connection lost' });

    const { logger } = await import('@twicely/logger');
    expect(logger.error).toHaveBeenCalledWith(
      'Error handling charge.refunded',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });
});
