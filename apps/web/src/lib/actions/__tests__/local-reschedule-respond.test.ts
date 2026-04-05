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

vi.mock('@twicely/jobs/local-meetup-reminder', () => ({
  enqueueLocalMeetupReminders: vi.fn().mockResolvedValue(undefined),
  removeLocalMeetupReminders: vi.fn().mockResolvedValue(undefined),
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { postReliabilityMark } from '@twicely/commerce/local-reliability';
import { validateProposedTime } from '@twicely/commerce/local-scheduling';
import { notify } from '@twicely/notifications/service';
import { regenerateTokensOnConfirmation, enqueueAutoCancelAtScheduledTime } from '../local-scheduling-helpers';
import { localAutoCancelQueue } from '@twicely/jobs/local-auto-cancel';
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
const mockNotify = vi.mocked(notify);
const mockPostMark = vi.mocked(postReliabilityMark);
const mockRegenTokens = vi.mocked(regenerateTokensOnConfirmation);
const mockEnqueueCancel = vi.mocked(enqueueAutoCancelAtScheduledTime);

// ─── respondToRescheduleAction ────────────────────────────────────────────────

describe('respondToRescheduleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTime.mockResolvedValue({ valid: true });
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    vi.mocked(localAutoCancelQueue.getJob).mockResolvedValue(null as never);
  });

  it('unauthorized returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('invalid input returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const result = await respondToRescheduleAction({ localTransactionId: '', accept: true });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('status is not RESCHEDULE_PENDING returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'SCHEDULED' })]) as never);
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No pending reschedule');
  });

  it('cannot accept own proposal', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    // BUYER_ID is also schedulingProposedBy — can't accept own
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ schedulingProposedBy: BUYER_ID })]) as never);
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own');
  });

  it('accept: updates scheduledAt, scheduledAtConfirmedAt, status to SCHEDULED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(result.success).toBe(true);
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ scheduledAt: PROPOSED_AT, status: 'SCHEDULED' });
    expect(setCalls[0]?.[0]?.scheduledAtConfirmedAt).toBeInstanceOf(Date);
  });

  it('accept: increments rescheduleCount', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ rescheduleCount: 1 })]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ rescheduleCount: 2 });
  });

  it('accept: sets lastRescheduledAt and lastRescheduledBy', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toHaveProperty('lastRescheduledAt');
    expect(setCalls[0]?.[0]).toHaveProperty('lastRescheduledBy', 'BUYER');
  });

  it('accept: clears rescheduleProposedAt', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ rescheduleProposedAt: null });
  });

  it('accept: regenerates tokens', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockRegenTokens).toHaveBeenCalledWith(TX_ID, 'ord-001', BUYER_ID, SELLER_ID, PROPOSED_AT);
  });

  it('accept: re-enqueues auto-cancel job', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockEnqueueCancel).toHaveBeenCalledWith(TX_ID, 'ord-001', BUYER_ID, SELLER_ID, PROPOSED_AT);
  });

  it('accept: sends accepted notification to proposer', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockNotify).toHaveBeenCalledWith(BUYER_ID, 'local.reschedule.accepted', expect.any(Object));
  });

  it('accept: posts RESCHEDULE_EXCESS mark on 3rd reschedule (count > maxCount)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    // rescheduleCount starts at 2, after increment = 3, max = 2 → mark posted
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ rescheduleCount: 2 })]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockPostMark).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'RESCHEDULE_EXCESS', marksApplied: -1, userId: BUYER_ID }),
    );
  });

  it('accept: does NOT post mark on 1st or 2nd reschedule', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    // count 0 → new count 1, max = 2 → no mark
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ rescheduleCount: 0 })]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(mockPostMark).not.toHaveBeenCalled();
  });

  it('accept: proposed time no longer valid returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockValidateTime.mockResolvedValue({ valid: false, error: 'Proposed time must be in the future' });
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('no longer valid');
  });

  it('decline: restores status to SCHEDULED', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    const result = await respondToRescheduleAction({ localTransactionId: TX_ID, accept: false });
    expect(result.success).toBe(true);
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ status: 'SCHEDULED' });
  });

  it('decline: clears rescheduleProposedAt', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: false });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ rescheduleProposedAt: null });
  });

  it('decline: does NOT change scheduledAt', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: false });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).not.toHaveProperty('scheduledAt');
  });

  it('decline: does NOT increment rescheduleCount', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ rescheduleCount: 1 })]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: false });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).not.toHaveProperty('rescheduleCount');
  });

  it('decline: sends declined notification to proposer', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await respondToRescheduleAction({ localTransactionId: TX_ID, accept: false });
    expect(mockNotify).toHaveBeenCalledWith(BUYER_ID, 'local.reschedule.declined', expect.any(Object));
  });
});
