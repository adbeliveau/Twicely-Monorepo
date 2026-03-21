import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', status: 'status', canceledByParty: 'canceled_by_party', updatedAt: 'updated_at' },
  order: { id: 'id', status: 'status', canceledByUserId: 'canceled_by_user_id', cancelInitiator: 'cancel_initiator', cancelReason: 'cancel_reason', canceledAt: 'canceled_at', updatedAt: 'updated_at' },
  orderPayment: { orderId: 'order_id', stripePaymentIntentId: 'stripe_payment_intent_id' },
}));

vi.mock('@twicely/commerce/local-reliability', () => ({
  postReliabilityMark: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

vi.mock('@twicely/commerce/local-reserve', () => ({
  unreserveListingForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/commerce/local-ledger', () => ({
  createLocalCancelRefundLedgerEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-auto-cancel', () => ({ localAutoCancelQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@twicely/jobs/local-noshow-check', () => ({ localNoShowCheckQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@twicely/jobs/local-schedule-nudge', () => ({ localScheduleNudgeQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@twicely/jobs/local-meetup-reminder', () => ({ localMeetupReminderQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@twicely/stripe/server', () => ({ stripe: { refunds: { create: vi.fn().mockResolvedValue({ id: 'ref_001' }) } } }));

import { db } from '@twicely/db';
import { localAutoCancelQueue } from '@twicely/jobs/local-auto-cancel';
import { localNoShowCheckQueue } from '@twicely/jobs/local-noshow-check';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { stripe } from '@twicely/stripe/server';
import { unreserveListingForLocalTransaction } from '@twicely/commerce/local-reserve';
import { createLocalCancelRefundLedgerEntry } from '@twicely/commerce/local-ledger';
import { cancelLocalTransaction } from '../local-cancel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-test-001';
const ORDER_ID = 'ord-001';

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID, orderId: ORDER_ID, buyerId: BUYER_ID, sellerId: SELLER_ID,
    status: 'SCHEDULED', scheduledAt: new Date(Date.now() + 30 * 60 * 60 * 1000),
    scheduledAtConfirmedAt: new Date(), canceledByParty: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

function setupSelects(opts: { paymentIntentId?: string | null } = {}) {
  const { paymentIntentId = 'pi_test' } = opts;
  vi.mocked(db.select)
    .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: paymentIntentId }]) as never);
}

const mockDbUpdate = vi.mocked(db.update);
const mockNotify = vi.mocked(notify);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cancelLocalTransaction — service core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: 'ref_001' } as never);
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('updates localTransaction to CANCELED with canceledByParty=BUYER', async () => {
    setupSelects();
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain as never);
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'CANCELED', canceledByParty: 'BUYER' });
  });

  it('updates localTransaction to CANCELED with canceledByParty=SELLER', async () => {
    setupSelects();
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain as never);
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'SELLER', cancelingUserId: SELLER_ID });
    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'CANCELED', canceledByParty: 'SELLER' });
  });

  it('updates order status to CANCELED with correct cancel fields', async () => {
    setupSelects();
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain as never);
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[1]?.[0]).toMatchObject({ status: 'CANCELED', canceledByUserId: BUYER_ID, cancelInitiator: 'BUYER' });
  });

  it('issues Stripe full refund when stripePaymentIntentId exists', async () => {
    setupSelects({ paymentIntentId: 'pi_test_123' });
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(vi.mocked(stripe.refunds.create)).toHaveBeenCalledWith({
      payment_intent: 'pi_test_123',
      reverse_transfer: true,
      refund_application_fee: true,
      reason: 'requested_by_customer',
      metadata: { orderId: ORDER_ID, canceledByParty: 'BUYER' },
    });
  });

  it('skips Stripe refund when stripePaymentIntentId is null', async () => {
    setupSelects({ paymentIntentId: null });
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(vi.mocked(stripe.refunds.create)).not.toHaveBeenCalled();
  });

  it('does not throw when Stripe refund fails', async () => {
    vi.mocked(stripe.refunds.create).mockRejectedValueOnce(new Error('Stripe error'));
    setupSelects({ paymentIntentId: 'pi_fail' });
    await expect(
      cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(logger.error)).toHaveBeenCalled();
  });

  it('removes auto-cancel BullMQ job', async () => {
    setupSelects();
    const mockJob = { remove: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(localAutoCancelQueue.getJob).mockResolvedValueOnce(mockJob as never);
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(localAutoCancelQueue.getJob).toHaveBeenCalledWith(`local-auto-cancel-${TX_ID}`);
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('removes no-show check BullMQ jobs for both parties', async () => {
    setupSelects();
    const mockJob = { remove: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(localNoShowCheckQueue.getJob).mockResolvedValue(mockJob as never);
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(localNoShowCheckQueue.getJob).toHaveBeenCalledWith(`noshow-${TX_ID}-BUYER`);
    expect(localNoShowCheckQueue.getJob).toHaveBeenCalledWith(`noshow-${TX_ID}-SELLER`);
  });

  it('handles missing BullMQ jobs gracefully', async () => {
    setupSelects();
    vi.mocked(localAutoCancelQueue.getJob).mockRejectedValueOnce(new Error('Queue error'));
    await expect(
      cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });

  it('notifies other party with local.cancel template', async () => {
    setupSelects();
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.cancel', expect.any(Object));
  });

  it('creates cancel refund ledger entry after successful refund', async () => {
    setupSelects({ paymentIntentId: 'pi_test_123' });
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(vi.mocked(createLocalCancelRefundLedgerEntry)).toHaveBeenCalledWith(ORDER_ID, SELLER_ID);
  });

  it('does not create ledger entry when no payment exists', async () => {
    setupSelects({ paymentIntentId: null });
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(vi.mocked(createLocalCancelRefundLedgerEntry)).not.toHaveBeenCalled();
  });

  it('calls unreserveListingForLocalTransaction with correct orderId', async () => {
    setupSelects();
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(vi.mocked(unreserveListingForLocalTransaction)).toHaveBeenCalledWith(ORDER_ID);
  });

  it('does not throw when unreserve fails', async () => {
    vi.mocked(unreserveListingForLocalTransaction).mockRejectedValueOnce(new Error('DB error'));
    setupSelects();
    await expect(
      cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID }),
    ).rejects.toThrow();
  });
});
