/**
 * Tests for handleChargebackWebhook (Finance Engine §5.5).
 *
 * Covers:
 * - Both CHARGEBACK_DEBIT and CHARGEBACK_FEE entries posted on charge.dispute.created
 * - Idempotency: re-processing the same webhook skips both inserts
 * - Fee amount read from platform_settings (commerce.chargeback.feeCents), default 1500
 * - Graceful handling when no order is found for the payment intent
 * - Missing payment_intent returns error
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

// getPlatformSetting returns the defaultVal for all keys by default.
// Tests that need a custom fee override it with mockReturnValueOnce.
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, defaultVal: unknown) => Promise.resolve(defaultVal)),
}));

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  dispute: { id: 'id', orderId: 'order_id', status: 'status', updatedAt: 'updated_at' },
  order: {
    id: 'id', buyerId: 'buyer_id', sellerId: 'seller_id',
    paymentIntentId: 'payment_intent_id', totalCents: 'total_cents', status: 'status', updatedAt: 'updated_at',
  },
  ledgerEntry: { id: 'id', type: 'type', stripeDisputeId: 'stripe_dispute_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => ({ and: args })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock the chargeback-evidence module (split file re-exported from chargebacks.ts)
vi.mock('../chargeback-evidence', () => ({
  submitChargebackEvidence: vi.fn().mockResolvedValue(undefined),
  handleChargebackResolution: vi.fn().mockResolvedValue(undefined),
  getChargebackStatus: vi.fn().mockResolvedValue(null),
}));

// ─── Chain builder helpers ────────────────────────────────────────────────────

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

// ─── Stripe dispute builder ───────────────────────────────────────────────────

function makeStripeDispute(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dp_test_001',
    payment_intent: 'pi_test_001',
    amount: 5000, // $50.00 disputed
    reason: 'fraudulent',
    status: 'warning_needs_response',
    evidence_details: { due_by: null },
    ...overrides,
  } as unknown as import('stripe').default.Dispute;
}

/** Set up insert mock: first call gets a dispute insert with .returning(), rest are plain ledger inserts. */
function setupInsertMock(disputeId: string) {
  let callCount = 0;
  mockDbInsert.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // dispute insert — caller chains .returning()
      return {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: disputeId }]),
        }),
      };
    }
    // ledger inserts — plain awaited .values()
    return { values: vi.fn().mockResolvedValue(undefined) };
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleChargebackWebhook', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    // Re-establish default: return the fallback value for any setting key.
    // resetAllMocks() clears the factory-provided implementation; this restores it.
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    (getPlatformSetting as Mock).mockImplementation((_key: string, defaultVal: unknown) =>
      Promise.resolve(defaultVal)
    );
  });

  it('posts CHARGEBACK_DEBIT and CHARGEBACK_FEE on first call (Finance Engine §5.5)', async () => {
    // DB select call sequence:
    //   1. find order by paymentIntentId
    //   2. check existing internal dispute → none (new dispute path)
    //   3. existingDebit guard → none (insert CHARGEBACK_DEBIT)
    //   4. existingFee guard → none (insert CHARGEBACK_FEE)
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'ord-1', buyerId: 'buyer-1', sellerId: 'seller-1', totalCents: 5000 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    mockDbUpdate.mockReturnValue(makeUpdateChain());
    setupInsertMock('disp-1');

    const { handleChargebackWebhook } = await import('../chargebacks');
    const result = await handleChargebackWebhook(makeStripeDispute(), 'evt_test_001');

    expect(result).toEqual({ success: true, disputeId: 'disp-1' });

    // 3 inserts total: dispute, CHARGEBACK_DEBIT, CHARGEBACK_FEE
    expect(mockDbInsert).toHaveBeenCalledTimes(3);

    // Verify CHARGEBACK_DEBIT
    const debitValues = mockDbInsert.mock.results[1]!.value.values.mock.calls[0]![0];
    expect(debitValues.type).toBe('CHARGEBACK_DEBIT');
    expect(debitValues.amountCents).toBe(-5000); // negated disputed amount
    expect(debitValues.status).toBe('POSTED');
    expect(debitValues.userId).toBe('seller-1');
    expect(debitValues.orderId).toBe('ord-1');
    expect(debitValues.stripeDisputeId).toBe('dp_test_001');

    // Verify CHARGEBACK_FEE
    const feeValues = mockDbInsert.mock.results[2]!.value.values.mock.calls[0]![0];
    expect(feeValues.type).toBe('CHARGEBACK_FEE');
    expect(feeValues.amountCents).toBe(-1500); // -$15.00 from platform_settings default
    expect(feeValues.status).toBe('POSTED');
    expect(feeValues.userId).toBe('seller-1');
    expect(feeValues.orderId).toBe('ord-1');
    expect(feeValues.stripeDisputeId).toBe('dp_test_001');
  });

  it('CHARGEBACK_FEE amount is read from platform_settings (commerce.chargeback.feeCents)', async () => {
    // Simulate admin having changed the fee to $20 (2000 cents)
    // getPlatformSetting default impl returns defaultVal; override only for the fee key
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');
    (getPlatformSetting as Mock).mockImplementation((key: string, defaultVal: unknown) => {
      if (key === 'commerce.chargeback.feeCents') return Promise.resolve(2000);
      return Promise.resolve(defaultVal);
    });

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'ord-2', buyerId: 'buyer-2', sellerId: 'seller-2', totalCents: 10000 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    mockDbUpdate.mockReturnValue(makeUpdateChain());
    setupInsertMock('disp-2');

    const { handleChargebackWebhook } = await import('../chargebacks');
    await handleChargebackWebhook(
      makeStripeDispute({ id: 'dp_test_002', payment_intent: 'pi_test_002', amount: 10000 }),
    );

    const feeValues = mockDbInsert.mock.results[2]!.value.values.mock.calls[0]![0];
    expect(feeValues.type).toBe('CHARGEBACK_FEE');
    expect(feeValues.amountCents).toBe(-2000); // -$20.00 from settings override
  });

  it('idempotency: re-processing same webhook skips BOTH CHARGEBACK_DEBIT and CHARGEBACK_FEE', async () => {
    // Existing dispute + both ledger entries already present
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'ord-3', buyerId: 'buyer-3', sellerId: 'seller-3', totalCents: 5000 }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'disp-3' }]))      // existing dispute → update path
      .mockReturnValueOnce(makeSelectChain([{ id: 'le-debit-1' }]))  // existing CHARGEBACK_DEBIT → skip
      .mockReturnValueOnce(makeSelectChain([{ id: 'le-fee-1' }]));   // existing CHARGEBACK_FEE → skip

    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const { handleChargebackWebhook } = await import('../chargebacks');
    const result = await handleChargebackWebhook(
      makeStripeDispute({ id: 'dp_test_003', payment_intent: 'pi_test_003' }),
    );

    expect(result).toEqual({ success: true, disputeId: 'disp-3' });
    // No ledger inserts — both were skipped
    expect(mockDbInsert).not.toHaveBeenCalled();

    // logger.info should have been called for both skips
    const { logger } = await import('@twicely/logger');
    const logInfoCalls = (logger.info as Mock).mock.calls.map((c) => String(c[0]));
    expect(logInfoCalls.some((msg) => msg.includes('skipping duplicate CHARGEBACK_DEBIT'))).toBe(true);
    expect(logInfoCalls.some((msg) => msg.includes('skipping duplicate CHARGEBACK_FEE'))).toBe(true);
  });

  it('idempotency partial: DEBIT exists but FEE missing — posts only CHARGEBACK_FEE', async () => {
    // Edge case: first run inserted CHARGEBACK_DEBIT then crashed before CHARGEBACK_FEE
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'ord-4', buyerId: 'buyer-4', sellerId: 'seller-4', totalCents: 5000 }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'disp-4' }]))      // existing dispute
      .mockReturnValueOnce(makeSelectChain([{ id: 'le-debit-2' }]))  // existing CHARGEBACK_DEBIT → skip
      .mockReturnValueOnce(makeSelectChain([]));                       // no CHARGEBACK_FEE → insert

    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const { handleChargebackWebhook } = await import('../chargebacks');
    await handleChargebackWebhook(makeStripeDispute({ id: 'dp_test_004', payment_intent: 'pi_test_004' }));

    // Only 1 insert: CHARGEBACK_FEE
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const feeValues = mockDbInsert.mock.results[0]!.value.values.mock.calls[0]![0];
    expect(feeValues.type).toBe('CHARGEBACK_FEE');
    expect(feeValues.amountCents).toBe(-1500);
  });

  it('CHARGEBACK_FEE amountCents is always negative (debit sign, Finance Engine §5.5)', async () => {
    // Fee must be a negative debit regardless of disputed amount
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'ord-5', buyerId: 'buyer-5', sellerId: 'seller-5', totalCents: 99999 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    mockDbUpdate.mockReturnValue(makeUpdateChain());
    setupInsertMock('disp-5');

    const { handleChargebackWebhook } = await import('../chargebacks');
    await handleChargebackWebhook(
      makeStripeDispute({ id: 'dp_test_005', payment_intent: 'pi_test_005', amount: 99999 }),
    );

    const feeValues = mockDbInsert.mock.results[2]!.value.values.mock.calls[0]![0];
    expect(feeValues.amountCents).toBeLessThan(0);
    expect(feeValues.amountCents).toBe(-1500);
  });

  it('returns success with no ledger writes when no order found (non-marketplace transaction)', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([])); // no order found

    const { handleChargebackWebhook } = await import('../chargebacks');
    const result = await handleChargebackWebhook(makeStripeDispute({ payment_intent: 'pi_unknown' }));

    expect(result).toEqual({ success: true });
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('returns error without DB calls when dispute has no payment_intent', async () => {
    const { handleChargebackWebhook } = await import('../chargebacks');
    const result = await handleChargebackWebhook(makeStripeDispute({ payment_intent: null }));

    expect(result).toEqual({ success: false, error: 'Dispute has no payment intent' });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
