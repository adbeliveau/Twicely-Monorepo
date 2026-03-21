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

vi.mock('@twicely/jobs/local-auto-cancel', () => ({
  localAutoCancelQueue: { add: vi.fn().mockResolvedValue(undefined) },
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

// Mock the helpers split module
vi.mock('../local-scheduling-helpers', () => ({
  regenerateTokensOnConfirmation: vi.fn().mockResolvedValue(undefined),
  enqueueAutoCancelAtScheduledTime: vi.fn().mockResolvedValue(undefined),
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { isUserSuspendedFromLocal } from '@twicely/commerce/local-reliability';
import { isTerminalStatus } from '@twicely/commerce/local-state-machine';
import { validateProposedTime } from '@twicely/commerce/local-scheduling';
import { notify } from '@twicely/notifications/service';
import { proposeMeetupTimeAction } from '../local-scheduling';

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
    status: 'SCHEDULED', scheduledAt: null, scheduledAtConfirmedAt: null,
    schedulingProposedBy: null, sellerConfirmationCode: 'seller.token.old',
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
const mockNotify = vi.mocked(notify);

const FUTURE_ISO = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

// ─── proposeMeetupTimeAction ──────────────────────────────────────────────────

describe('proposeMeetupTimeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTerminal.mockReturnValue(false);
    mockValidateTime.mockResolvedValue({ valid: true });
    vi.mocked(isUserSuspendedFromLocal).mockResolvedValue({ suspended: false });
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('unauthorized returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('invalid input returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const result = await proposeMeetupTimeAction({ localTransactionId: '', proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('user not buyer/seller returns Not found', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession('other-999') as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('suspended user returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    vi.mocked(isUserSuspendedFromLocal).mockResolvedValue({ suspended: true, resumesAt: new Date() });
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toContain('suspended');
  });

  it('time in past / too soon returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockValidateTime.mockResolvedValue({ valid: false, error: 'Proposed time must be in the future' });
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('time too far returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockValidateTime.mockResolvedValue({ valid: false, error: 'Proposed time must be within 30 days' });
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('already confirmed scheduling returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAtConfirmedAt: new Date() })]) as never);
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toContain('confirmed');
  });

  it('buyer can propose successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(true);
  });

  it('seller can propose successfully', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(true);
  });

  it('sets scheduledAt and schedulingProposedBy on update', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    mockDbUpdate.mockReturnValue(updateChain as never);
    await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(setCalls[0]?.[0]).toMatchObject({ schedulingProposedBy: BUYER_ID, scheduledAtConfirmedAt: null });
  });

  it('sends notification to other party', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.schedule.proposal', expect.any(Object));
  });

  it('CASL check denies unrelated user', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility(false) as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx()]) as never);
    const result = await proposeMeetupTimeAction({ localTransactionId: TX_ID, proposedAt: FUTURE_ISO });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});
