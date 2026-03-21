import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {},
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/commerce/local-reliability', () => ({
  isUserSuspendedFromLocal: vi.fn().mockResolvedValue({ suspended: false }),
  postReliabilityMark: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/commerce/local-scheduling', () => ({
  validateProposedTime: vi.fn().mockResolvedValue({ valid: true }),
  canRequestReschedule: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

vi.mock('../local-scheduling-helpers', () => ({
  regenerateTokensOnConfirmation: vi.fn().mockResolvedValue(undefined),
  enqueueAutoCancelAtScheduledTime: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-auto-cancel', () => ({
  localAutoCancelQueue: { getJob: vi.fn().mockResolvedValue(null) },
}));

const mockEnqueueReminders = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockRemoveReminders = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@twicely/jobs/local-meetup-reminder', () => ({
  enqueueLocalMeetupReminders: mockEnqueueReminders,
  removeLocalMeetupReminders: mockRemoveReminders,
  localMeetupReminderQueue: { add: vi.fn(), getJob: vi.fn().mockResolvedValue(null) },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { validateProposedTime } from '@twicely/commerce/local-scheduling';
import { respondToRescheduleAction } from '../local-reschedule';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-test-001';
const PROPOSED_AT = new Date(Date.now() + 4 * 60 * 60 * 1000);

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}
function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID, orderId: 'ord-001', buyerId: BUYER_ID, sellerId: SELLER_ID,
    status: 'RESCHEDULE_PENDING',
    scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    scheduledAtConfirmedAt: new Date(Date.now() - 60 * 60 * 1000),
    schedulingProposedBy: BUYER_ID,
    rescheduleCount: 0, lastRescheduledAt: null, lastRescheduledBy: null,
    originalScheduledAt: null, rescheduleProposedAt: PROPOSED_AT,
    sellerCheckedIn: false, buyerCheckedIn: false,
    sellerCheckedInAt: null, buyerCheckedInAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}
function makeUpdateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}
function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);
const mockValidateTime = vi.mocked(validateProposedTime);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('respondToRescheduleAction — reminder re-enqueue integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTime.mockResolvedValue({ valid: true });
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('respondToRescheduleAction (accept) calls removeLocalMeetupReminders then enqueueLocalMeetupReminders', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockRemoveReminders).toHaveBeenCalledWith(TX_ID);
    expect(mockEnqueueReminders).toHaveBeenCalledTimes(1);
  });

  it('respondToRescheduleAction (accept) passes the new proposedAt as scheduledAtIso', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockEnqueueReminders).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAtIso: PROPOSED_AT.toISOString(),
      }),
    );
  });

  it('respondToRescheduleAction (decline) does NOT call enqueueLocalMeetupReminders', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: false });
    expect(mockEnqueueReminders).not.toHaveBeenCalled();
    expect(mockRemoveReminders).not.toHaveBeenCalled();
  });

  it('respondToRescheduleAction (accept) does not throw if reminder remove/enqueue fails', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockRemoveReminders.mockRejectedValueOnce(new Error('queue down'));
    mockEnqueueReminders.mockRejectedValueOnce(new Error('BullMQ unavailable'));
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(result.success).toBe(true);
  });
});
