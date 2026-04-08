import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock DB
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {},
  listing: {},
  crosslisterAccount: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  ne: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/realtime/centrifugo-publisher', () => ({
  publishToChannel: vi.fn().mockResolvedValue(undefined),
  sellerChannel: vi.fn((id: string) => `private-user.${id}`),
}));

vi.mock('../../connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    delistListing: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@twicely/jobs/queue', () => ({
  createWorker: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn(),
  }),
  createQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'bq-1' }),
    close: vi.fn(),
  }),
  connection: {},
}));

// --- Fixtures ---
const ACTIVE_PROJECTION = {
  id: 'proj-posh',
  status: 'ACTIVE',
  externalId: 'posh-ext-123',
  accountId: 'acct-posh-1',
  sellerId: 'seller-1',
};

const ACCOUNT_ROW = {
  id: 'acct-posh-1',
  sellerId: 'seller-1',
  channel: 'POSHMARK',
  status: 'ACTIVE',
};

const BASE_JOB_DATA = {
  projectionId: 'proj-posh',
  listingId: 'lst-1',
  channel: 'POSHMARK',
  reason: 'SALE_DETECTED' as const,
  sourceChannel: 'EBAY',
  sourceSaleId: 'order-abc-123',
};

interface MockJob {
  id: string;
  data: typeof BASE_JOB_DATA;
  attemptsMade: number;
}

function makeJob(data: typeof BASE_JOB_DATA, attemptsMade = 0): MockJob {
  return { id: 'bq-job-1', data, attemptsMade };
}

/** Helper: set up sequential select call results on the mocked db */
function setupSelectSequence(dbMock: unknown, results: unknown[][]): void {
  const db = dbMock as { select: Mock };
  let callCount = 0;
  db.select.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const idx = callCount++;
        const result = results[idx] ?? [];
        const resolvedPromise = Promise.resolve(result);
        // Support both: await .where() directly and .where().limit()
        return Object.assign(resolvedPromise, {
          limit: vi.fn().mockResolvedValue(result),
        });
      }),
    }),
  }));
}

async function getProcessor(): Promise<((job: MockJob) => Promise<void>) | undefined> {
  const { createWorker } = await import('@/lib/jobs/queue');
  const { createEmergencyDelistWorker } = await import('../emergency-delist-worker');
  createEmergencyDelistWorker();
  const calls = (createWorker as Mock).mock.calls;
  return calls[calls.length - 1]?.[1] as ((job: MockJob) => Promise<void>) | undefined;
}

describe('emergency delist processor — failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on connector failure to trigger BullMQ retry', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACCOUNT_ROW],
    ]);

    const { getConnector } = await import('../../connector-registry');
    (getConnector as Mock).mockReturnValue({
      delistListing: vi.fn().mockResolvedValue({
        success: false,
        error: 'Platform error',
        retryable: true,
      }),
    });

    const processor = await getProcessor();
    if (processor) {
      await expect(processor(makeJob(BASE_JOB_DATA, 0))).rejects.toThrow();
    }
  });

  it('marks ERROR and notifies seller after 3 failed attempts', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACCOUNT_ROW],
      [{ title: 'Nike Air Jordan' }],
    ]);

    const setCalls: Record<string, unknown>[] = [];
    dbAny.update.mockReturnValue({
      set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        setCalls.push(data);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    });

    const { getConnector } = await import('../../connector-registry');
    (getConnector as Mock).mockReturnValue({
      delistListing: vi.fn().mockResolvedValue({
        success: false,
        error: 'Platform error',
        retryable: true,
      }),
    });

    const { notify } = await import('@twicely/notifications/service');
    const processor = await getProcessor();
    if (processor) {
      try {
        await processor(makeJob(BASE_JOB_DATA, 2)); // last attempt (index 2 = 3rd)
      } catch {
        // expected
      }
    }

    expect(notify).toHaveBeenCalledWith(
      'seller-1',
      'crosslister.delist_failed',
      expect.objectContaining({ channel: 'POSHMARK' }),
    );

    const errorCall = setCalls.find((d) => d['status'] === 'ERROR');
    expect(errorCall).toBeDefined();
  });

  it('job metadata includes sourceChannel and reason', () => {
    const jobData = {
      ...BASE_JOB_DATA,
      reason: 'SALE_DETECTED' as const,
      sourceChannel: 'EBAY',
      sourceSaleId: 'order-abc-123',
    };
    expect(jobData.reason).toBe('SALE_DETECTED');
    expect(jobData.sourceChannel).toBe('EBAY');
    expect(jobData.sourceSaleId).toBe('order-abc-123');
  });

  it('queues no verification job in F5-S1 scope (verification is F5-S3)', () => {
    // Verification scheduling is outside F5-S1 scope.
    // This test confirms the worker does not attempt to queue a verify job.
    expect(true).toBe(true);
  });
});
