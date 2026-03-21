import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', orderId: 'order_id', sellerId: 'seller_id', buyerId: 'buyer_id', status: 'status', updatedAt: 'updated_at' },
  localFraudFlag: { id: 'id', sellerId: 'seller_id', localTransactionId: 'local_transaction_id', listingId: 'listing_id', trigger: 'trigger', severity: 'severity', status: 'status', refundIssuedAt: 'refund_issued_at', sellerBannedAt: 'seller_banned_at' },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  orderPayment: { orderId: 'order_id', stripePaymentIntentId: 'stripe_payment_intent_id' },
  order: { id: 'id', itemSubtotalCents: 'item_subtotal_cents' },
  listing: { id: 'id', status: 'status', updatedAt: 'updated_at', enforcementState: 'enforcement_state' },
  ledgerEntry: {},
  user: { id: 'id', updatedAt: 'updated_at', localFraudBannedAt: 'local_fraud_banned_at' },
  sellerProfile: { userId: 'user_id', status: 'status', updatedAt: 'updated_at' },
  auditEvent: {},
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: { refunds: { create: vi.fn() } },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

import { db } from '@twicely/db';
import { stripe } from '@twicely/stripe/server';
import {
  detectSameListingSold,
  checkNoshowRelist,
  checkPhashDuplicate,
} from '../local-fraud-detection';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_ID = 'ord-001';
const LISTING_ID = 'lst-001';
const SELLER_ID = 'usr-seller';
const BUYER_ID = 'usr-buyer';
const TX_ID = 'lt-001';
const PAYMENT_INTENT_ID = 'pi_test123';
const FLAG_ID = 'flag-001';

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
    innerJoin: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  return chain;
}

// Terminal at .where() — for count queries
function makeWhereTerminalChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  return chain;
}

function makeInsertChain(returning: unknown[] = []) {
  const chain = {
    values: vi.fn(),
    returning: vi.fn().mockResolvedValue(returning),
  };
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

// ─── detectSameListingSold ────────────────────────────────────────────────────

describe('detectSameListingSold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: 'refund-001' } as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([{ id: FLAG_ID }]) as never);
  });

  it('returns fraudDetected: false when no active local transaction for the listing', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never); // no conflicting tx

    const result = await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    expect(result.fraudDetected).toBe(false);
  });

  it('returns fraudDetected: false when conflicting tx is cash (no Stripe payment)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: TX_ID, orderId: 'ord-local', buyerId: BUYER_ID, status: 'SCHEDULED' }]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never); // no payment on conflicting order

    const result = await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    expect(result.fraudDetected).toBe(false);
  });

  it('returns fraudDetected: true and conflictingTransactionId when active local tx found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: TX_ID, orderId: 'ord-local', buyerId: BUYER_ID, status: 'SCHEDULED' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: 0 }]) as never);

    const result = await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    expect(result.fraudDetected).toBe(true);
    expect(result.conflictingTransactionId).toBe(TX_ID);
  });

  it('creates localFraudFlag with severity CONFIRMED and trigger SAME_LISTING_SOLD', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: TX_ID, orderId: 'ord-local', buyerId: BUYER_ID, status: 'SCHEDULED' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: 0 }]) as never);

    const insertChain = makeInsertChain([{ id: FLAG_ID }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    expect(vi.mocked(db.insert)).toHaveBeenCalled();
    const insertedValues = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues?.severity).toBe('CONFIRMED');
    expect(insertedValues?.trigger).toBe('SAME_LISTING_SOLD');
  });

  it('refunds the CONFLICTING local order payment (not the completing order)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: TX_ID, orderId: 'ord-local', buyerId: BUYER_ID, status: 'SCHEDULED' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: 0 }]) as never);

    await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    expect(vi.mocked(stripe.refunds.create)).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: PAYMENT_INTENT_ID }),
    );
  });

  it('sets user.localFraudBannedAt on detection', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: TX_ID, orderId: 'ord-local', buyerId: BUYER_ID, status: 'SCHEDULED' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: 0 }]) as never);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const banCall = setCalls.find(([s]) => 'localFraudBannedAt' in s);
    expect(banCall).toBeDefined();
    expect(banCall?.[0]?.localFraudBannedAt).toBeInstanceOf(Date);
  });

  it('cancels the conflicting local transaction', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ id: TX_ID, orderId: 'ord-local', buyerId: BUYER_ID, status: 'SCHEDULED' }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: PAYMENT_INTENT_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeWhereTerminalChain([{ total: 0 }]) as never);
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);

    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const cancelCall = setCalls.find(([s]) => s?.status === 'CANCELED');
    expect(cancelCall).toBeDefined();
  });

  it('returns fraudDetected: false when completing order IS the local transaction order', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never); // no conflict (filtered by NOT same orderId)

    const result = await detectSameListingSold(ORDER_ID, LISTING_ID, SELLER_ID);
    expect(result.fraudDetected).toBe(false);
  });
});

// ─── checkNoshowRelist ────────────────────────────────────────────────────────

describe('checkNoshowRelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.insert).mockReturnValue(makeInsertChain([]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
  });

  it('creates STRONG_SIGNAL flag when listing is re-activated within window', async () => {
    const noShowTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const relistTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago (after noshow)

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ status: 'NO_SHOW', updatedAt: noShowTime }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE', updatedAt: relistTime }]) as never);

    await checkNoshowRelist(TX_ID, SELLER_ID, ORDER_ID);

    // Verify insert was called for the flag creation
    expect(vi.mocked(db.insert).mock.calls.length).toBeGreaterThan(0);
  });

  it('does nothing when listing is NOT re-activated', async () => {
    const noShowTime = new Date(Date.now() - 60 * 60 * 1000);

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ status: 'NO_SHOW', updatedAt: noShowTime }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'PAUSED', updatedAt: new Date() }]) as never);

    await checkNoshowRelist(TX_ID, SELLER_ID, ORDER_ID);

    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('does nothing when transaction is no longer in NO_SHOW status', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ status: 'CANCELED', updatedAt: new Date() }]) as never);

    await checkNoshowRelist(TX_ID, SELLER_ID, ORDER_ID);

    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('does nothing when listing updatedAt is before noShowTimestamp', async () => {
    const noShowTime = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const listingTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago (before noshow)

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ status: 'NO_SHOW', updatedAt: noShowTime }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE', updatedAt: listingTime }]) as never);

    await checkNoshowRelist(TX_ID, SELLER_ID, ORDER_ID);

    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });
});

// ─── checkPhashDuplicate ──────────────────────────────────────────────────────

describe('checkPhashDuplicate', () => {
  it('returns { duplicate: false } (deferred)', () => {
    const result = checkPhashDuplicate();
    expect(result.duplicate).toBe(false);
  });
});
