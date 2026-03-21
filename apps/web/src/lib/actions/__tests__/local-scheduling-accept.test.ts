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

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@twicely/jobs/local-auto-cancel', () => ({
  localAutoCancelQueue: { add: mockQueueAdd },
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
import { isTerminalStatus } from '@twicely/commerce/local-state-machine';
import { validateProposedTime } from '@twicely/commerce/local-scheduling';
import { notify } from '@twicely/notifications/service';
import { acceptMeetupTimeAction } from '../local-scheduling';
import {
  enqueueAutoCancelAtScheduledTime,
} from '../local-scheduling-helpers';

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

// ─── acceptMeetupTimeAction ───────────────────────────────────────────────────

describe('acceptMeetupTimeAction', () => {
  const scheduledAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTerminal.mockReturnValue(false);
    mockValidateTime.mockResolvedValue({ valid: true });
    mockDbUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('unauthorized returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('no proposed time returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(makeSelectChain([makeTx({ scheduledAt: null })]) as never);
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No meetup time');
  });

  it('already confirmed returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, scheduledAtConfirmedAt: new Date(), schedulingProposedBy: SELLER_ID })]) as never,
    );
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already confirmed');
  });

  it('cannot accept own proposal', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: BUYER_ID })]) as never,
    );
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('own proposal');
  });

  it('proposed time now stale returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    mockValidateTime.mockResolvedValue({ valid: false, error: 'Proposed time must be in the future' });
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('buyer can accept seller proposal', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(true);
  });

  it('seller can accept buyer proposal', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(SELLER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: BUYER_ID })]) as never,
    );
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(true);
  });

  it('sets scheduledAtConfirmedAt on accept', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    mockDbUpdate.mockReturnValue(updateChain as never);
    await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const firstSet = setCalls[0]?.[0];
    expect(firstSet).toHaveProperty('scheduledAtConfirmedAt');
    expect(firstSet?.scheduledAtConfirmedAt).toBeInstanceOf(Date);
  });

  it('enqueues auto-cancel job', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(enqueueAutoCancelAtScheduledTime).toHaveBeenCalledWith(
      TX_ID, 'ord-001', BUYER_ID, SELLER_ID, scheduledAt,
    );
  });

  it('sends notification to other party', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.schedule.accepted', expect.any(Object));
  });

  it('CASL check denies unrelated user', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility(false) as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('terminal status returns error', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(BUYER_ID) as never, ability: makeAbility() as never });
    mockDbSelect.mockReturnValue(
      makeSelectChain([makeTx({ status: 'CANCELED', scheduledAt, schedulingProposedBy: SELLER_ID })]) as never,
    );
    mockIsTerminal.mockReturnValue(true);
    const result = await acceptMeetupTimeAction({ localTransactionId: TX_ID });
    expect(result.success).toBe(false);
    expect(result.error).toContain('terminal');
  });
});
