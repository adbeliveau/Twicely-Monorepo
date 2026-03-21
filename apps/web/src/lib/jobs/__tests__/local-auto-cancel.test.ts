import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateWorker = vi.hoisted(() => vi.fn().mockReturnValue({ close: vi.fn() }));

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd, close: vi.fn() }),
  createWorker: mockCreateWorker,
}));

const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());

vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: { id: 'id', status: 'status', updatedAt: 'updated_at' },
  order: { id: 'id', status: 'status', updatedAt: 'updated_at' },
  helpdeskCase: { id: 'id' },
}));

const mockNotify = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn().mockReturnValue('test-cuid-id'),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(48),
}));

import { enqueueLocalAutoCancel, localAutoCancelQueue } from '../local-auto-cancel';
import { logger } from '@twicely/logger';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type JobData = {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
};
type JobLike = { data: JobData };

/** Capture processor at import time — before clearAllMocks wipes mock.calls */
const processAutoCancel = mockCreateWorker.mock.calls[0]![1] as (job: JobLike) => Promise<void>;

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

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TX_ID = 'cltx-autocancel01';
const ORDER_ID = 'cord-autocancel01';
const BUYER_ID = 'cbuyer-autocancel';
const SELLER_ID = 'csellr-autocancel';

const JOB_DATA: JobData = {
  localTransactionId: TX_ID,
  orderId: ORDER_ID,
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
};

// ─── enqueueLocalAutoCancel ──────────────────────────────────────────────────

describe('enqueueLocalAutoCancel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a job with 48-hour delay', async () => {
    await enqueueLocalAutoCancel(JOB_DATA);

    const callArgs = mockQueueAdd.mock.calls[0] as [string, JobData, { delay: number }];
    expect(callArgs[2]?.delay).toBe(48 * 60 * 60 * 1000);
  });

  it('uses unique jobId per transaction', async () => {
    await enqueueLocalAutoCancel(JOB_DATA);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'cancel',
      JOB_DATA,
      expect.objectContaining({ jobId: `local-auto-cancel-${TX_ID}` }),
    );
  });

  it('exports localAutoCancelQueue', () => {
    expect(localAutoCancelQueue).toBeDefined();
  });
});

// ─── processAutoCancel (via worker processor) ────────────────────────────────

describe('auto-cancel worker — SCHEDULED status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
  });

  it('cancels transaction and order when status is SCHEDULED', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'SCHEDULED' }]));

    await processAutoCancel({ data: JOB_DATA });

    // Two update calls: localTransaction + order
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it('transitions order status to CANCELED', async () => {
    const updateChain = makeUpdateChain();
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'SCHEDULED' }]));
    mockDbUpdate.mockReturnValue(updateChain);

    await processAutoCancel({ data: JOB_DATA });

    const setCalls = updateChain.set.mock.calls as Array<[Record<string, unknown>]>;
    const statuses = setCalls.map((c) => c[0]?.status);
    expect(statuses).toContain('CANCELED');
  });

  it('notifies both buyer and seller', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'SCHEDULED' }]));

    await processAutoCancel({ data: JOB_DATA });

    expect(mockNotify).toHaveBeenCalledWith(BUYER_ID, 'local.auto_cancel', { orderId: ORDER_ID });
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.auto_cancel', { orderId: ORDER_ID });
  });

  it('does NOT create helpdesk case for SCHEDULED (no check-in)', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'SCHEDULED' }]));

    await processAutoCancel({ data: JOB_DATA });

    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

describe('auto-cancel worker — investigation statuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue(makeUpdateChain());
    mockDbInsert.mockReturnValue(makeInsertChain());
  });

  it('creates URGENT helpdesk case when SELLER_CHECKED_IN', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'SELLER_CHECKED_IN' }]));

    await processAutoCancel({ data: JOB_DATA });

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const insertValues = (mockDbInsert().values.mock.calls[0] as Array<Record<string, unknown>>)[0];
    expect(insertValues).toMatchObject({
      type: 'ORDER',
      priority: 'URGENT',
      status: 'NEW',
      channel: 'SYSTEM',
      orderId: ORDER_ID,
    });
  });

  it('creates URGENT helpdesk case when BUYER_CHECKED_IN', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'BUYER_CHECKED_IN' }]));

    await processAutoCancel({ data: JOB_DATA });

    expect(mockDbInsert).toHaveBeenCalled();
  });

  it('creates URGENT helpdesk case when BOTH_CHECKED_IN', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'BOTH_CHECKED_IN' }]));

    await processAutoCancel({ data: JOB_DATA });

    expect(mockDbInsert).toHaveBeenCalled();
  });
});

describe('auto-cancel worker — terminal statuses (idempotent)', () => {
  beforeEach(() => vi.clearAllMocks());

  const TERMINAL = ['COMPLETED', 'CANCELED', 'RECEIPT_CONFIRMED', 'NO_SHOW', 'DISPUTED'] as const;

  for (const status of TERMINAL) {
    it(`skips ${status} — no update, no notify, no helpdesk case`, async () => {
      mockDbSelect.mockReturnValue(makeSelectChain([{ status }]));

      await processAutoCancel({ data: JOB_DATA });

      expect(mockDbUpdate).not.toHaveBeenCalled();
      expect(mockNotify).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  }
});

describe('auto-cancel worker — edge cases', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs warning and returns if transaction not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    await processAutoCancel({ data: JOB_DATA });

    expect(logger.warn).toHaveBeenCalledWith(
      '[local-auto-cancel] Transaction not found',
      expect.objectContaining({ id: TX_ID }),
    );
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('logs info on successful auto-cancel', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ status: 'SCHEDULED' }]));
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    await processAutoCancel({ data: JOB_DATA });

    expect(logger.info).toHaveBeenCalledWith(
      '[local-auto-cancel] Auto-cancel complete',
      expect.objectContaining({
        localTransactionId: TX_ID,
        needsInvestigation: false,
      }),
    );
  });
});
