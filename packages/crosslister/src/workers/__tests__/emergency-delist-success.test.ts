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
  sql: vi.fn(),
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

function setupUpdateMock(dbMock: unknown): void {
  const db = dbMock as { update: Mock };
  db.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

async function getProcessor(): Promise<((job: MockJob) => Promise<void>) | undefined> {
  const { createWorker } = await import('@twicely/jobs/queue');
  const { createEmergencyDelistWorker } = await import('../emergency-delist-worker');
  createEmergencyDelistWorker();
  const calls = (createWorker as Mock).mock.calls;
  return calls[calls.length - 1]?.[1] as ((job: MockJob) => Promise<void>) | undefined;
}

describe('createEmergencyDelistWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a BullMQ worker for lister:emergency-delist', async () => {
    const { createEmergencyDelistWorker } = await import('../emergency-delist-worker');
    const { createWorker } = await import('@twicely/jobs/queue');

    createEmergencyDelistWorker();

    expect(createWorker).toHaveBeenCalledWith(
      'lister:emergency-delist',
      expect.any(Function),
      expect.any(Number),
    );
  });
});

describe('emergency delist processor — success paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates projection to DELISTED on successful delist', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACCOUNT_ROW],
      [], // no active projections remaining
    ]);
    setupUpdateMock(db);

    const { getConnector } = await import('../../connector-registry');
    (getConnector as Mock).mockReturnValue({
      delistListing: vi.fn().mockResolvedValue({ success: true }),
    });

    const processor = await getProcessor();
    if (processor) {
      await processor(makeJob(BASE_JOB_DATA));
    }

    expect(dbAny.update).toHaveBeenCalled();
  });

  it('emits delist.completed Centrifugo event when all projections delisted', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [ACCOUNT_ROW],
      [], // no active projections remaining
    ]);
    setupUpdateMock(db);

    const { getConnector } = await import('../../connector-registry');
    (getConnector as Mock).mockReturnValue({
      delistListing: vi.fn().mockResolvedValue({ success: true }),
    });

    const { publishToChannel } = await import('@twicely/realtime/centrifugo-publisher');
    const processor = await getProcessor();
    if (processor) {
      await processor(makeJob(BASE_JOB_DATA));
    }

    expect(publishToChannel).toHaveBeenCalledWith(
      'private-user.seller-1',
      expect.objectContaining({ event: 'delist.completed', listingId: 'lst-1' }),
    );
  });

  it('skips idempotently when projection is already DELISTED', async () => {
    const { db } = await import('@twicely/db');

    setupSelectSequence(db, [
      [{ ...ACTIVE_PROJECTION, status: 'DELISTED' }],
    ]);

    const { getConnector } = await import('../../connector-registry');
    const processor = await getProcessor();
    if (processor) {
      await processor(makeJob(BASE_JOB_DATA));
    }

    expect(getConnector).not.toHaveBeenCalled();
  });

  it('Tier C platform (session-based) goes through same delist flow', async () => {
    const { db } = await import('@twicely/db');
    const sessionAccount = { ...ACCOUNT_ROW, channel: 'POSHMARK' };

    setupSelectSequence(db, [
      [ACTIVE_PROJECTION],
      [sessionAccount],
      [],
    ]);
    setupUpdateMock(db);

    const { getConnector } = await import('../../connector-registry');
    const mockDelist = vi.fn().mockResolvedValue({ success: true });
    (getConnector as Mock).mockReturnValue({ delistListing: mockDelist });

    const processor = await getProcessor();
    if (processor) {
      await processor(makeJob(BASE_JOB_DATA));
    }

    expect(mockDelist).toHaveBeenCalledWith(sessionAccount, ACTIVE_PROJECTION.externalId);
  });

  it('does not cross-contaminate projections from different listings', async () => {
    const { db } = await import('@twicely/db');
    const dbAny = db as unknown as { update: Mock };

    setupSelectSequence(db, [
      [{ ...ACTIVE_PROJECTION, id: 'proj-other', listingId: 'lst-99' }],
      [ACCOUNT_ROW],
      [],
    ]);
    setupUpdateMock(db);

    const { getConnector } = await import('../../connector-registry');
    (getConnector as Mock).mockReturnValue({
      delistListing: vi.fn().mockResolvedValue({ success: true }),
    });

    const processor = await getProcessor();
    if (processor) {
      await processor(makeJob({ ...BASE_JOB_DATA, projectionId: 'proj-other', listingId: 'lst-99' }));
    }

    expect(dbAny.update).toHaveBeenCalled();
  });
});
