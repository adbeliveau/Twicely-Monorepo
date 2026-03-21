import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localFraudFlag: { id: 'id', sellerId: 'seller_id', localTransactionId: 'local_transaction_id', listingId: 'listing_id', refundIssuedAt: 'refund_issued_at', sellerBannedAt: 'seller_banned_at', status: 'status', updatedAt: 'updated_at', listingRemovedAt: 'listing_removed_at' },
  localTransaction: { id: 'id', orderId: 'order_id' },
  ledgerEntry: {},
  user: { id: 'id', updatedAt: 'updated_at', localFraudBannedAt: 'local_fraud_banned_at' },
  listing: { id: 'id', updatedAt: 'updated_at', enforcementState: 'enforcement_state' },
  sellerProfile: { userId: 'user_id', status: 'status', updatedAt: 'updated_at' },
  order: { id: 'id', itemSubtotalCents: 'item_subtotal_cents' },
  orderPayment: { orderId: 'order_id', stripePaymentIntentId: 'stripe_payment_intent_id' },
  auditEvent: {},
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: { refunds: { create: vi.fn() } },
}));

const mockNotify = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@twicely/notifications/service', () => ({
  notify: mockNotify,
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(2),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { applyConfirmedFraudConsequences } from '../local-fraud-consequences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FLAG_ID = 'flag-test-001';
const SELLER_ID = 'seller-test-001';
const STAFF_ID = 'staff-test-001';
const LISTING_ID = 'lst-test-001';
const TX_ID = 'lt-test-001';
const ORDER_ID = 'ord-test-001';
const PAYMENT_INTENT_ID = 'pi_test_001';
const REFUND_ID = 'refund-test-001';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeCountChain(total: number) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([{ total }]),
  };
  chain.from.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain = { values: vi.fn().mockResolvedValue(undefined) };
  chain.values.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeFlag(overrides: Record<string, unknown> = {}) {
  return {
    id: FLAG_ID,
    sellerId: SELLER_ID,
    localTransactionId: TX_ID,
    listingId: LISTING_ID,
    refundIssuedAt: null,
    sellerBannedAt: null,
    ...overrides,
  };
}

// ─── applyConfirmedFraudConsequences ─────────────────────────────────────────

describe('applyConfirmedFraudConsequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify.mockResolvedValue(undefined);
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: REFUND_ID } as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(getPlatformSetting).mockResolvedValue(2 as never);
  });

  it('returns early with empty result when flag is not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    expect(result.refundIssued).toBe(false);
    expect(result.sellerBanned).toBe(false);
    expect(result.accountSuspended).toBe(false);
    expect(result.listingRemoved).toBe(false);
  });

  it('issues Stripe refund and creates ledger entry when not already refunded', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeFlag()]) as never)           // flag
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never) // tx
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never) // payment
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 3000 }]) as never) // order
      .mockReturnValueOnce(makeCountChain(0) as never); // confirmed count

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    expect(vi.mocked(stripe.refunds.create)).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: PAYMENT_INTENT_ID }),
    );
    expect(result.refundIssued).toBe(true);
  });

  it('marks refundIssued=true without calling Stripe when already refunded', async () => {
    const flagWithRefund = makeFlag({ refundIssuedAt: new Date('2026-01-01') });
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([flagWithRefund]) as never) // flag
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never) // tx
      .mockReturnValueOnce(makeCountChain(0) as never); // confirmed count

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    expect(vi.mocked(stripe.refunds.create)).not.toHaveBeenCalled();
    expect(result.refundIssued).toBe(true);
  });

  it('sets user.localFraudBannedAt when not already banned', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeFlag()]) as never)           // flag
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never) // tx
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 0 }]) as never)
      .mockReturnValueOnce(makeCountChain(0) as never);

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    expect(result.sellerBanned).toBe(true);
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const banCall = setCalls.find(([s]) => 'localFraudBannedAt' in s);
    expect(banCall).toBeDefined();
    expect(banCall?.[0]?.localFraudBannedAt).toBeInstanceOf(Date);
  });

  it('skips ban when seller already banned (sellerBannedAt is set)', async () => {
    // sellerBannedAt set, but refundIssuedAt is null — code will still try to refund
    const flagWithBan = makeFlag({ sellerBannedAt: new Date('2026-01-01') });
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([flagWithBan]) as never)           // flag
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never) // tx
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never) // payment
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 0 }]) as never) // order (for ledger)
      .mockReturnValueOnce(makeCountChain(0) as never); // confirmed count

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    expect(result.sellerBanned).toBe(false);
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const banCall = setCalls.find(([s]) => 'localFraudBannedAt' in s);
    expect(banCall).toBeUndefined();
  });

  it('suspends account when confirmedCount+1 >= patternThreshold (2nd offense)', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(2 as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeFlag()]) as never)           // flag
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never) // tx
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 0 }]) as never)
      .mockReturnValueOnce(makeCountChain(1) as never); // 1 prior confirmed + 1 = 2 >= threshold

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'second offense',
    });

    expect(result.accountSuspended).toBe(true);
  });

  it('does NOT suspend account on 1st offense when confirmedCount+1 < threshold', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(2 as never);
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeFlag()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 0 }]) as never)
      .mockReturnValueOnce(makeCountChain(0) as never); // 0 prior + 1 = 1 < 2

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'first offense',
    });

    expect(result.accountSuspended).toBe(false);
  });

  it('sets listing.enforcementState = REMOVED', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeFlag()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 0 }]) as never)
      .mockReturnValueOnce(makeCountChain(0) as never);

    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    const result = await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    expect(result.listingRemoved).toBe(true);
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const removedCall = setCalls.find(([s]) => s?.enforcementState === 'REMOVED');
    expect(removedCall).toBeDefined();
  });

  it('creates a CRITICAL audit event for confirmed fraud', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([makeFlag()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ orderId: ORDER_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 0 }]) as never)
      .mockReturnValueOnce(makeCountChain(0) as never);

    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await applyConfirmedFraudConsequences({
      flagId: FLAG_ID,
      staffId: STAFF_ID,
      resolutionNote: 'confirmed',
    });

    const insertCalls = vi.mocked(insertChain.values).mock.calls as Array<[Record<string, unknown>]>;
    const auditCall = insertCalls.find(([v]) => v?.severity === 'CRITICAL');
    expect(auditCall).toBeDefined();
    expect(auditCall?.[0]?.actorType).toBe('STAFF');
    expect(auditCall?.[0]?.actorId).toBe(STAFF_ID);
  });
});
