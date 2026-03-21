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
import { dayOfConfirmationTimeoutQueue } from '@twicely/jobs/local-day-of-confirmation-timeout';
import { respondToDayOfConfirmationAction } from '../local-day-of-confirmation';

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
const mockNotify = vi.mocked(notify);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ─── respondToDayOfConfirmationAction Tests ───────────────────────────────────

describe('respondToDayOfConfirmationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
    vi.mocked(dayOfConfirmationTimeoutQueue.getJob).mockResolvedValue(null as never);
  });

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns Not found when transaction does not exist', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when user is not the seller', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession('other-999') as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when user is the buyer (seller-only action)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when CASL denies seller update', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility(false) as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns error when dayOfConfirmationSentAt is null (no request)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: null })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No day-of confirmation request');
  });

  it('returns error when dayOfConfirmationRespondedAt is not null (already responded)', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date(), dayOfConfirmationRespondedAt: new Date() })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already responded');
  });

  it('returns error when dayOfConfirmationExpired is true', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date(), dayOfConfirmationExpired: true })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('window has expired');
  });

  it('returns error when status is terminal', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date(), status: 'COMPLETED' })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('no longer active');
  });

  it('sets dayOfConfirmationRespondedAt on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    const result = await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('removes BullMQ timeout job on success', async () => {
    const mockJob = { remove: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(dayOfConfirmationTimeoutQueue.getJob).mockResolvedValue(mockJob as never);
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('notifies buyer on success', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(mockNotify).toHaveBeenCalledWith(BUYER_ID, 'local.dayof.confirmed', expect.objectContaining({ time: expect.any(String) }));
  });

  it('revalidates both buying and selling order paths', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ dayOfConfirmationSentAt: new Date() })]) as never);
    await respondToDayOfConfirmationAction({ localTransactionId: TX_ID });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/buying/orders');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/orders');
  });
});
