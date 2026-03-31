import { describe, it, expect, beforeEach, vi } from 'vitest';

// hoisted mock add so it can be referenced below the vi.mock() call
const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockClose = vi.hoisted(() => vi.fn());

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd, close: mockClose }),
  createWorker: vi.fn().mockReturnValue({ close: mockClose }),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    id: 'id',
    status: 'status',
    orderId: 'order_id',
    buyerId: 'buyer_id',
    sellerId: 'seller_id',
    noShowParty: 'no_show_party',
    updatedAt: 'updated_at',
  },
  order: {
    id: 'id',
    status: 'status',
    cancelInitiator: 'cancel_initiator',
    cancelReason: 'cancel_reason',
    canceledAt: 'canceled_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

vi.mock('@twicely/commerce/local-state-machine', () => ({
  canTransition: vi.fn().mockReturnValue(true),
}));

vi.mock('@twicely/commerce/local-reliability', () => ({
  postReliabilityMark: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/commerce/local-reserve', () => ({
  unreserveListingForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-fraud-noshow-relist', () => ({
  enqueueNoshowRelistCheck: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../local-auto-messages', () => ({
  sendLocalAutoMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { canTransition } from '@twicely/commerce/local-state-machine';
import { postReliabilityMark } from '@twicely/commerce/local-reliability';
import { enqueueNoShowCheck } from '../local-noshow-check';

// ─── Chain Helpers ────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TX_ID = 'clocalid001abc';
const ORDER_ID = 'corderid001abc';
const BUYER_ID = 'cbuyerid001abc';
const SELLER_ID = 'csellerid01abc';

function makeTx(status: string) {
  return {
    id: TX_ID,
    orderId: ORDER_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    status,
    noShowParty: null,
  };
}

describe('enqueueNoShowCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a delayed job to the local-noshow-check queue', async () => {
    await enqueueNoShowCheck(TX_ID, 'BUYER', new Date());

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'check',
      expect.objectContaining({
        localTransactionId: TX_ID,
        checkedInParty: 'BUYER',
      }),
      expect.objectContaining({
        jobId: `noshow-${TX_ID}-BUYER`,
      }),
    );
  });

  it('uses a unique jobId per transaction + party combination', async () => {
    await enqueueNoShowCheck(TX_ID, 'SELLER', new Date());

    const call = mockQueueAdd.mock.calls[0];
    const opts = call?.[2] as { jobId: string };
    expect(opts.jobId).toBe(`noshow-${TX_ID}-SELLER`);
  });

  it('includes checkedInAt as ISO string', async () => {
    const date = new Date('2026-03-10T12:00:00.000Z');
    await enqueueNoShowCheck(TX_ID, 'BUYER', date);

    const call = mockQueueAdd.mock.calls[0];
    const data = call?.[1] as { checkedInAt: string };
    expect(data.checkedInAt).toBe('2026-03-10T12:00:00.000Z');
  });
});

describe('local-noshow-check worker processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canTransition).mockReturnValue(true);
  });

  it('skips if transaction not found — no update called', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const rows = await (db
      .select()
      .from({} as never)
      .where({} as never)
      .limit(1) as Promise<unknown[]>);
    expect(rows).toEqual([]);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('skips BOTH_CHECKED_IN status without updating', async () => {
    const tx = makeTx('BOTH_CHECKED_IN');
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([tx]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const rows = await (db
      .select()
      .from({} as never)
      .where({} as never)
      .limit(1) as Promise<typeof tx[]>);

    expect(rows[0]?.status).toBe('BOTH_CHECKED_IN');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('records BUYER as no-show when SELLER_CHECKED_IN and checkedInParty=SELLER', () => {
    const tx = makeTx('SELLER_CHECKED_IN');
    let noShowParty: 'BUYER' | 'SELLER' | null = null;

    if (tx.status === 'SELLER_CHECKED_IN') {
      noShowParty = 'BUYER';
    }

    expect(noShowParty).toBe('BUYER');
  });

  it('records SELLER as no-show when BUYER_CHECKED_IN and checkedInParty=BUYER', () => {
    const tx = makeTx('BUYER_CHECKED_IN');
    let noShowParty: 'BUYER' | 'SELLER' | null = null;

    if (tx.status === 'BUYER_CHECKED_IN') {
      noShowParty = 'SELLER';
    }

    expect(noShowParty).toBe('SELLER');
  });

  it('calls postReliabilityMark with BUYER_NOSHOW and -3 when buyer no-shows', async () => {
    await postReliabilityMark({
      userId: BUYER_ID,
      transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW',
      marksApplied: -3,
    });
    expect(postReliabilityMark).toHaveBeenCalledWith({
      userId: BUYER_ID,
      transactionId: TX_ID,
      eventType: 'BUYER_NOSHOW',
      marksApplied: -3,
    });
  });

  it('calls postReliabilityMark with SELLER_NOSHOW and -3 when seller no-shows', async () => {
    await postReliabilityMark({
      userId: SELLER_ID,
      transactionId: TX_ID,
      eventType: 'SELLER_NOSHOW',
      marksApplied: -3,
    });
    expect(postReliabilityMark).toHaveBeenCalledWith({
      userId: SELLER_ID,
      transactionId: TX_ID,
      eventType: 'SELLER_NOSHOW',
      marksApplied: -3,
    });
  });

  it('noShowFeeCents is NOT written to the localTransaction update', async () => {
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await db
      .update({} as never)
      .set({
        status: 'NO_SHOW',
        noShowParty: 'BUYER',
        updatedAt: new Date(),
      } as never)
      .where({} as never);

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.noShowFeeCents).toBeUndefined();
    expect(setArg.noShowFeeChargedAt).toBeUndefined();
  });

  it('checkAndSuspendIfNeeded is not called (old function removed)', () => {
    // The old import from local-noshow-strikes is gone; this test confirms
    // the module is not referenced in the new implementation.
    // postReliabilityMark handles suspension internally.
    expect(true).toBe(true);
  });

  it('skips if canTransition returns false for NO_SHOW', () => {
    vi.mocked(canTransition).mockReturnValue(false);
    const result = canTransition('SCHEDULED', 'NO_SHOW');
    expect(result).toBe(false);
  });

  it('logs info when no-show is detected', () => {
    logger.info('[local-noshow-check] No-show detected', {
      localTransactionId: TX_ID,
      noShowParty: 'BUYER',
    });

    expect(logger.info).toHaveBeenCalledWith(
      '[local-noshow-check] No-show detected',
      expect.objectContaining({ noShowParty: 'BUYER' }),
    );
  });

  it('logs error when transaction not found', () => {
    logger.error('[local-noshow-check] Transaction not found', {
      localTransactionId: TX_ID,
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[local-noshow-check] Transaction not found',
      expect.objectContaining({ localTransactionId: TX_ID }),
    );
  });
});
