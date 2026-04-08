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

vi.mock('@twicely/commerce/local-reserve', () => ({
  unreserveListingForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

const mockAutoCancelGetJob = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockNoShowGetJob = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockNudgeGetJob = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockReminderGetJob = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock('@twicely/jobs/local-auto-cancel', () => ({
  localAutoCancelQueue: { getJob: mockAutoCancelGetJob },
}));
vi.mock('@twicely/jobs/local-noshow-check', () => ({
  localNoShowCheckQueue: { getJob: mockNoShowGetJob },
}));
vi.mock('@twicely/jobs/local-schedule-nudge', () => ({
  localScheduleNudgeQueue: { getJob: mockNudgeGetJob },
}));
vi.mock('@twicely/jobs/local-meetup-reminder', () => ({
  localMeetupReminderQueue: { getJob: mockReminderGetJob },
  enqueueLocalMeetupReminders: vi.fn().mockResolvedValue(undefined),
  removeLocalMeetupReminders: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: { refunds: { create: vi.fn().mockResolvedValue({ id: 'ref_001' }) } },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { cancelLocalTransaction } from '../local-cancel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-test-cleanup-001';
const ORDER_ID = 'ord-cleanup-001';

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
  const { paymentIntentId = null } = opts;
  vi.mocked(db.select)
    .mockReturnValueOnce(makeSelectChain([{ stripePaymentIntentId: paymentIntentId }]) as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cleanupBullMQJobs — reminder job cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
  });

  it('cleanupBullMQJobs removes local-reminder-24hr-{txId} job', async () => {
    const mockJob = { remove: vi.fn().mockResolvedValue(undefined) };
    mockReminderGetJob.mockImplementation((jobId: string) =>
      jobId === `local-reminder-24hr-${TX_ID}` ? Promise.resolve(mockJob) : Promise.resolve(null),
    );
    setupSelects();
    await cancelLocalTransaction({
      transaction: makeTx() as never,
      cancelingParty: 'BUYER',
      cancelingUserId: BUYER_ID,
    });
    expect(mockReminderGetJob).toHaveBeenCalledWith(`local-reminder-24hr-${TX_ID}`);
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('cleanupBullMQJobs removes local-reminder-1hr-{txId} job', async () => {
    const mockJob = { remove: vi.fn().mockResolvedValue(undefined) };
    mockReminderGetJob.mockImplementation((jobId: string) =>
      jobId === `local-reminder-1hr-${TX_ID}` ? Promise.resolve(mockJob) : Promise.resolve(null),
    );
    setupSelects();
    await cancelLocalTransaction({
      transaction: makeTx() as never,
      cancelingParty: 'BUYER',
      cancelingUserId: BUYER_ID,
    });
    expect(mockReminderGetJob).toHaveBeenCalledWith(`local-reminder-1hr-${TX_ID}`);
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('cleanupBullMQJobs handles missing reminder jobs gracefully', async () => {
    mockReminderGetJob.mockResolvedValue(null);
    setupSelects();
    await expect(
      cancelLocalTransaction({
        transaction: makeTx() as never,
        cancelingParty: 'BUYER',
        cancelingUserId: BUYER_ID,
      }),
    ).resolves.not.toThrow();
    expect(logger.warn).not.toHaveBeenCalledWith(
      '[local-cancel] Could not remove BullMQ job',
      expect.objectContaining({ jobId: `local-reminder-24hr-${TX_ID}` }),
    );
  });
});
