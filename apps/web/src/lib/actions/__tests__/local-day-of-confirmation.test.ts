import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));
vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), update: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({ localTransaction: {} }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));
vi.mock('@twicely/jobs/local-day-of-confirmation-timeout', () => ({
  enqueueDayOfConfirmationTimeout: vi.fn().mockResolvedValue(undefined),
  dayOfConfirmationTimeoutQueue: { getJob: vi.fn().mockResolvedValue(null) },
}));

import { revalidatePath } from 'next/cache';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { notify } from '@twicely/notifications/service';
import { enqueueDayOfConfirmationTimeout } from '@twicely/jobs/local-day-of-confirmation-timeout';
import { sendDayOfConfirmationAction } from '../local-day-of-confirmation';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-test-001';

function makeSession(userId: string) {
  return { userId, isSeller: true, delegationId: null, onBehalfOfSellerId: null };
}
function makeAbility(canUpdate = true) { return { can: vi.fn().mockReturnValue(canUpdate) }; }
function makeTx(overrides: Record<string, unknown> = {}) {
  const scheduledAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return { id: TX_ID, orderId: 'ord-001', buyerId: BUYER_ID, sellerId: SELLER_ID, status: 'SCHEDULED', scheduledAt, scheduledAtConfirmedAt: new Date(), dayOfConfirmationSentAt: null, dayOfConfirmationRespondedAt: null, dayOfConfirmationExpired: false, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}
function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}
function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbUpdate = vi.mocked(db.update);
const mockEnqueue = vi.mocked(enqueueDayOfConfirmationTimeout);
const mockNotify = vi.mocked(notify);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ─── sendDayOfConfirmationAction Tests ────────────────────────────────────────

describe('sendDayOfConfirmationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns Not found when transaction does not exist', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when user is not the buyer', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession('other-999') as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when user is the seller (buyer-only action)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when CASL denies buyer update', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility(false) as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns error when scheduledAtConfirmedAt is null', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAtConfirmedAt: null })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Meetup time must be confirmed');
  });

  it('returns error when dayOfConfirmationSentAt is not null (already sent)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already been sent');
  });

  it('returns error when status is BOTH_CHECKED_IN', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'BOTH_CHECKED_IN' })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot send confirmation request at this stage');
  });

  it('returns error when status is COMPLETED (terminal)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'COMPLETED' })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot send confirmation request at this stage');
  });

  it('returns error when status is CANCELED (terminal)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'CANCELED' })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot send confirmation request at this stage');
  });

  it('returns error when status is RESCHEDULE_PENDING', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'RESCHEDULE_PENDING' })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot send confirmation request at this stage');
  });

  it('returns error when outside confirmation window (too early)', async () => {
    const scheduledAt = new Date(Date.now() + 20 * 60 * 60 * 1000);
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAt })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Too early');
  });

  it('returns error when scheduledAt has passed (too late)', async () => {
    const scheduledAt = new Date(Date.now() - 60 * 60 * 1000);
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAt })]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already passed');
  });

  it('sets dayOfConfirmationSentAt on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('enqueues BullMQ timeout job on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ localTransactionId: TX_ID }));
  });

  it('notifies seller on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.dayof.request', expect.objectContaining({ time: expect.any(String) }));
  });

  it('revalidates both buying and selling order paths', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await sendDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/buying/orders');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/orders');
  });
});
