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
  order: {},
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/commerce/local-reliability', () => ({
  isUserSuspendedFromLocal: vi.fn().mockResolvedValue({ suspended: false }),
}));

vi.mock('@twicely/commerce/local-state-machine', () => ({
  isTerminalStatus: vi.fn().mockReturnValue(false),
}));

vi.mock('@twicely/commerce/local-scheduling', () => ({
  validateProposedTime: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(48),
}));

vi.mock('@twicely/commerce/local-token', () => ({
  generateTokenPair: vi.fn().mockReturnValue({
    sellerToken: 'new.seller.token', buyerToken: 'new.buyer.token',
    sellerOfflineCode: '111111', buyerOfflineCode: '222222',
    sellerNonce: 'nonce1', buyerNonce: 'nonce2',
  }),
}));

vi.mock('../local-scheduling-helpers', () => ({
  regenerateTokensOnConfirmation: vi.fn().mockResolvedValue(undefined),
  enqueueAutoCancelAtScheduledTime: vi.fn().mockResolvedValue(undefined),
}));

const mockEnqueueReminders = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@twicely/jobs/local-meetup-reminder', () => ({
  enqueueLocalMeetupReminders: mockEnqueueReminders,
  removeLocalMeetupReminders: vi.fn().mockResolvedValue(undefined),
  localMeetupReminderQueue: { add: vi.fn(), getJob: vi.fn().mockResolvedValue(null) },
}));

vi.mock('@twicely/jobs/local-auto-cancel', () => ({
  localAutoCancelQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { isTerminalStatus } from '@twicely/commerce/local-state-machine';
import { validateProposedTime } from '@twicely/commerce/local-scheduling';
import { acceptMeetupTimeAction, proposeMeetupTimeAction } from '../local-scheduling';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-test-001';

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}
function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID, orderId: 'ord-001', buyerId: BUYER_ID, sellerId: SELLER_ID,
    status: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    scheduledAtConfirmedAt: null,
    schedulingProposedBy: SELLER_ID,
    sellerConfirmationCode: 'seller.token.old',
    sellerOfflineCode: '111111', buyerConfirmationCode: 'buyer.token.old',
    buyerOfflineCode: '222222', confirmationMode: null,
    sellerCheckedIn: false, buyerCheckedIn: false,
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
const mockIsTerminal = vi.mocked(isTerminalStatus);
const mockValidateTime = vi.mocked(validateProposedTime);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('acceptMeetupTimeAction — reminder enqueue integration', () => {
  const scheduledAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTerminal.mockReturnValue(false);
    mockValidateTime.mockResolvedValue({ valid: true });
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('acceptMeetupTimeAction calls enqueueLocalMeetupReminders on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(mockEnqueueReminders).toHaveBeenCalledTimes(1);
  });

  it('acceptMeetupTimeAction passes correct localTransactionId and scheduledAtIso', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(mockEnqueueReminders).toHaveBeenCalledWith(
      expect.objectContaining({
        localTransactionId: TX_ID,
        scheduledAtIso: scheduledAt.toISOString(),
      }),
    );
  });

  it('acceptMeetupTimeAction does not throw if reminder enqueue fails', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    mockEnqueueReminders.mockRejectedValueOnce(new Error('BullMQ unavailable'));
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    // The action should still succeed even if reminder enqueue fails (void + catch)
    expect(result.success).toBe(true);
  });

  it('proposeMeetupTimeAction does NOT enqueue reminders (only accept does)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt: null, scheduledAtConfirmedAt: null, schedulingProposedBy: null })]) as never,
    );
    await proposeMeetupTimeAction({
      localTransactionId: TX_ID,
      proposedAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    });
    expect(mockEnqueueReminders).not.toHaveBeenCalled();
  });
});
