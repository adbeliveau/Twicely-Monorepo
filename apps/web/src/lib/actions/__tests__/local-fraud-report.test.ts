import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localFraudFlag: { localTransactionId: 'local_transaction_id', trigger: 'trigger' },
  localTransaction: { id: 'id', buyerId: 'buyer_id', sellerId: 'seller_id', orderId: 'order_id', status: 'status' },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  listing: { id: 'id', enforcementState: 'enforcement_state' },
  auditEvent: {},
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/commerce/local-fraud-consequences', () => ({
  applyConfirmedFraudConsequences: vi.fn().mockResolvedValue({
    refundIssued: true,
    sellerBanned: true,
    accountSuspended: false,
    listingRemoved: true,
  }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { reportLocalFraudAction } from '../local-fraud';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const TX_ID = 'lt-001';
const ORDER_ID = 'ord-001';
const LISTING_ID = 'lst-001';

function makeSession(userId: string) {
  return { userId, isSeller: false, delegationId: null, onBehalfOfSellerId: null };
}

function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
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

function makeInsertChain() {
  const chain = {
    values: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([]),
  };
  chain.values.mockReturnValue(chain);
  return chain;
}

const mockAuthorize = vi.mocked(authorize);
const mockDbSelect = vi.mocked(db.select);
const mockDbInsert = vi.mocked(db.insert);

const validInput = {
  localTransactionId: TX_ID,
  description: 'Seller sold the item elsewhere after I paid SafeTrade escrow.',
};

const makeTx = (overrides: Record<string, unknown> = {}) => ({
  id: TX_ID,
  orderId: ORDER_ID,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  status: 'SCHEDULED',
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('reportLocalFraudAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReturnValue(makeInsertChain() as never);
  });

  it('returns Unauthorized when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility() as never });

    const result = await reportLocalFraudAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('creates MANUAL_REVIEW flag for valid buyer report', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([makeTx()]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never) // no existing flag
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never);

    const insertChain = makeInsertChain();
    mockDbInsert.mockReturnValue(insertChain as never);

    const result = await reportLocalFraudAction(validInput);

    expect(result.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalled();
    const insertedValues = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues?.severity).toBe('MANUAL_REVIEW');
    expect(insertedValues?.trigger).toBe('BUYER_CLAIM');
  });

  it('rejects when user is not the buyer of the transaction', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession('some-other-user') as never,
      ability: makeAbility() as never,
    });
    mockDbSelect.mockReturnValueOnce(makeSelectChain([makeTx()]) as never);

    const result = await reportLocalFraudAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('rejects duplicate reports for same transaction', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([makeTx()]) as never)
      .mockReturnValueOnce(makeSelectChain([{ id: 'flag-existing' }]) as never); // existing flag

    const result = await reportLocalFraudAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already submitted');
  });

  it('rejects invalid input — description too short', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const result = await reportLocalFraudAction({
      localTransactionId: TX_ID,
      description: 'short',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('rejects when CASL denies update on LocalTransaction', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility(false) as never,
    });
    mockDbSelect.mockReturnValueOnce(makeSelectChain([makeTx()]) as never);

    const result = await reportLocalFraudAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});
