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

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { isUserSuspendedFromLocal } from '@twicely/commerce/local-reliability';
import { validateProposedTime, canRequestReschedule } from '@twicely/commerce/local-scheduling';
import { notify } from '@twicely/notifications/service';
import { proposeRescheduleAction } from '../local-reschedule';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-test-001';
const FUTURE_ISO = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

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
    scheduledAtConfirmedAt: new Date(),
    schedulingProposedBy: SELLER_ID,
    rescheduleCount: 0, lastRescheduledAt: null, lastRescheduledBy: null,
    originalScheduledAt: null, rescheduleProposedAt: null,
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
const mockCanReschedule = vi.mocked(canRequestReschedule);
const mockNotify = vi.mocked(notify);

// ─── proposeRescheduleAction ──────────────────────────────────────────────────

describe('proposeRescheduleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateTime.mockResolvedValue({ valid: true });
    mockCanReschedule.mockReturnValue(true);
    vi.mocked(isUserSuspendedFromLocal).mockResolvedValue({ suspended: false });
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('unauthorized returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('invalid input returns error (empty transaction ID)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const result = await proposeRescheduleAction({ localTransactionId: '', proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('user not buyer/seller returns Not found', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession('other-999') as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('CASL denied returns Not found', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility(false) as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('suspended user returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    vi.mocked(isUserSuspendedFromLocal).mockResolvedValue({ suspended: true, resumesAt: new Date() });
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toContain('suspended');
  });

  it('scheduling not yet confirmed returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAtConfirmedAt: null })]) as never);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toContain('scheduling flow');
  });

  it('status is BOTH_CHECKED_IN returns error (canRequestReschedule false)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'BOTH_CHECKED_IN' })]) as never);
    mockCanReschedule.mockReturnValue(false);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('status is COMPLETED (terminal) returns error (canRequestReschedule false)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'COMPLETED' })]) as never);
    mockCanReschedule.mockReturnValue(false);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
  });

  it('already RESCHEDULE_PENDING returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'RESCHEDULE_PENDING' })]) as never);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already pending');
  });

  it('proposed time too soon returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockValidateTime.mockResolvedValue({ valid: false, error: 'Proposed time must be at least 1 hour from now' });
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('proposed time too far returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockValidateTime.mockResolvedValue({ valid: false, error: 'Proposed time must be within 30 days' });
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('buyer can propose reschedule successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(true);
  });

  it('seller can propose reschedule successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(true);
  });

  it('sets status to RESCHEDULE_PENDING', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ status: 'RESCHEDULE_PENDING' });
  });

  it('stores proposed time in rescheduleProposedAt', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toHaveProperty('rescheduleProposedAt');
    expect(setCalls[0]?.[0]?.rescheduleProposedAt).toBeInstanceOf(Date);
  });

  it('does NOT overwrite scheduledAt', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).not.toHaveProperty('scheduledAt');
  });

  it('resets check-in states', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ sellerCheckedIn: true })]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ sellerCheckedIn: false, buyerCheckedIn: false });
  });

  it('sets originalScheduledAt on first reschedule', async () => {
    const confirmedAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAt: confirmedAt, originalScheduledAt: null })]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ originalScheduledAt: confirmedAt });
  });

  it('does NOT overwrite originalScheduledAt on second reschedule', async () => {
    const firstOriginal = new Date(Date.now() + 1 * 60 * 60 * 1000);
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ originalScheduledAt: firstOriginal })]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ originalScheduledAt: firstOriginal });
  });

  it('sends notification to other party', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await proposeRescheduleAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.reschedule.proposal', expect.any(Object));
  });
});
