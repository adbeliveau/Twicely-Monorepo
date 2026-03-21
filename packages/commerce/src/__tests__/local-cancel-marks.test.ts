import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', status: 'status', canceledByParty: 'canceled_by_party', updatedAt: 'updated_at' },
  order: { id: 'id', status: 'status', canceledByUserId: 'canceled_by_user_id', cancelInitiator: 'cancel_initiator', cancelReason: 'cancel_reason', canceledAt: 'canceled_at', updatedAt: 'updated_at' },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  listing: { id: 'id', status: 'status', updatedAt: 'updated_at' },
  orderPayment: { orderId: 'order_id', stripePaymentIntentId: 'stripe_payment_intent_id' },
}));

vi.mock('@twicely/commerce/local-reliability', () => ({
  postReliabilityMark: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
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
vi.mock('@/lib/jobs/local-auto-cancel', () => ({ localAutoCancelQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/lib/jobs/local-noshow-check', () => ({ localNoShowCheckQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/lib/jobs/local-schedule-nudge', () => ({ localScheduleNudgeQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@/lib/jobs/local-meetup-reminder', () => ({ localMeetupReminderQueue: { getJob: vi.fn().mockResolvedValue(null) } }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@twicely/stripe/server', () => ({ stripe: { refunds: { create: vi.fn().mockResolvedValue({ id: 'ref_001' }) } } }));

import { db } from '@twicely/db';
import { postReliabilityMark } from '@twicely/commerce/local-reliability';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { stripe } from '@twicely/stripe/server';
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

function setupDefaultSelects() {
  vi.mocked(db.select)
    .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: null }]) as never);
}

const mockPostMark = vi.mocked(postReliabilityMark);
const mockGetSetting = vi.mocked(getPlatformSetting);

// ─── Reliability Mark Determination ──────────────────────────────────────────

describe('cancelLocalTransaction — reliability marks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: 'ref_001' } as never);
    mockGetSetting.mockImplementation((_k: string, fb: unknown) => Promise.resolve(fb));
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
  });

  it('posts BUYER_CANCEL_GRACEFUL when 24hr+ before scheduledAt', async () => {
    setupDefaultSelects();
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'BUYER_CANCEL_GRACEFUL', marksApplied: 0 }));
  });

  it('posts BUYER_CANCEL_LATE when under 24hr before scheduledAt', async () => {
    setupDefaultSelects();
    const scheduledAt = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'BUYER_CANCEL_LATE', marksApplied: -1 }));
  });

  it('posts BUYER_CANCEL_SAMEDAY when under 2hr before scheduledAt', async () => {
    setupDefaultSelects();
    const scheduledAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'BUYER_CANCEL_SAMEDAY', marksApplied: -2 }));
  });

  it('posts SELLER_CANCEL_GRACEFUL when seller cancels 24hr+ before', async () => {
    setupDefaultSelects();
    await cancelLocalTransaction({ transaction: makeTx() as never, cancelingParty: 'SELLER', cancelingUserId: SELLER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SELLER_CANCEL_GRACEFUL', marksApplied: 0 }));
  });

  it('posts SELLER_CANCEL_LATE when seller cancels under 24hr', async () => {
    setupDefaultSelects();
    const scheduledAt = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'SELLER', cancelingUserId: SELLER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SELLER_CANCEL_LATE', marksApplied: -1 }));
  });

  it('posts SELLER_CANCEL_SAMEDAY when seller cancels under 2hr', async () => {
    setupDefaultSelects();
    const scheduledAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'SELLER', cancelingUserId: SELLER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'SELLER_CANCEL_SAMEDAY', marksApplied: -2 }));
  });

  it('posts 0 marks when scheduledAt is null', async () => {
    setupDefaultSelects();
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt: null }) as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'BUYER_CANCEL_GRACEFUL', marksApplied: 0 }));
  });

  it('reads cancel window hours from platform_settings', async () => {
    setupDefaultSelects();
    const scheduledAt = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockGetSetting).toHaveBeenCalledWith('commerce.local.cancelLateHours', 24);
    expect(mockGetSetting).toHaveBeenCalledWith('commerce.local.cancelSamedayHours', 2);
  });

  it('reads mark values from platform_settings', async () => {
    setupDefaultSelects();
    const scheduledAt = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockGetSetting).toHaveBeenCalledWith('commerce.local.markCancelLate', -1);
  });

  it('uses fallback mark values when platform_settings unavailable', async () => {
    setupDefaultSelects();
    mockGetSetting.mockImplementation((key: string, fb: unknown) => {
      if (key === 'commerce.local.markCancelLate') return Promise.resolve(-1);
      return Promise.resolve(fb);
    });
    const scheduledAt = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await cancelLocalTransaction({ transaction: makeTx({ scheduledAt }) as never, cancelingParty: 'BUYER', cancelingUserId: BUYER_ID });
    expect(mockPostMark).toHaveBeenCalledWith(expect.objectContaining({ marksApplied: -1 }));
  });
});
