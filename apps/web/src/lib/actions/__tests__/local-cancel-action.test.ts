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

vi.mock('@twicely/commerce/local-cancel', () => ({
  cancelLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

import { revalidatePath } from 'next/cache';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { cancelLocalTransaction } from '@twicely/commerce/local-cancel';
import { cancelLocalTransactionAction } from '../local-cancel';

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
    id: TX_ID,
    orderId: 'ord-001',
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    status: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
    scheduledAtConfirmedAt: new Date(),
    canceledByParty: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockCancelService = vi.mocked(cancelLocalTransaction);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cancelLocalTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancelService.mockResolvedValue(undefined);
  });

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns Not found when transaction does not exist', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when user is neither buyer nor seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession('other-999') as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when CASL denies buyer update', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility(false) as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns Not found when CASL denies seller update', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(SELLER_ID) as never,
      ability: makeAbility(false) as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns error when status is BOTH_CHECKED_IN', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'BOTH_CHECKED_IN' })]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be canceled');
  });

  it('returns error when status is COMPLETED (terminal)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'COMPLETED' })]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be canceled');
  });

  it('returns error when status is CANCELED (terminal)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'CANCELED' })]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be canceled');
  });

  it('returns error when status is NO_SHOW (terminal)', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ status: 'NO_SHOW' })]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be canceled');
  });

  it('returns error when status is ADJUSTMENT_PENDING', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ status: 'ADJUSTMENT_PENDING' })]) as never,
    );
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be canceled');
  });

  it('returns error when status is RECEIPT_CONFIRMED', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ status: 'RECEIPT_CONFIRMED' })]) as never,
    );
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot be canceled');
  });

  it('calls cancelLocalTransaction service on valid buyer cancel', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(true);
    expect(mockCancelService).toHaveBeenCalledWith(
      expect.objectContaining({ cancelingParty: 'BUYER', cancelingUserId: BUYER_ID }),
    );
  });

  it('calls cancelLocalTransaction service on valid seller cancel', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(SELLER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(true);
    expect(mockCancelService).toHaveBeenCalledWith(
      expect.objectContaining({ cancelingParty: 'SELLER', cancelingUserId: SELLER_ID }),
    );
  });

  it('revalidates both buying and selling order paths', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await cancelLocalTransactionAction({ localTransactionId: TX_ID });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/buying/orders');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/orders');
  });

  it('passes reason to service when provided', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await cancelLocalTransactionAction({
      localTransactionId: TX_ID,
      reason: 'Schedule conflict',
    });
    expect(result.success).toBe(true);
    expect(mockCancelService).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Schedule conflict' }),
    );
  });
});
