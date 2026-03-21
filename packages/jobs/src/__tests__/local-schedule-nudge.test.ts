import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateWorker = vi.hoisted(() => vi.fn().mockReturnValue({ close: vi.fn() }));

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  createWorker: mockCreateWorker,
}));

const mockDbSelect = vi.hoisted(() => vi.fn());

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {},
}));

const mockNotify = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(24),
}));

import { enqueueLocalScheduleNudge } from '../local-schedule-nudge';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type JobData = {
  localTransactionId: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  itemTitle: string;
};

type JobLike = { data: JobData };

const processNudge = mockCreateWorker.mock.calls[0]![1] as (job: JobLike) => Promise<void>;

function makeSelectChain(rows: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn().mockResolvedValue(rows) };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const TX_ID = 'lt-nudge-001';
const BUYER_ID = 'buyer-001';
const SELLER_ID = 'seller-001';
const ITEM_TITLE = 'Nike Air Jordan';

const JOB_DATA: JobData = {
  localTransactionId: TX_ID,
  orderId: 'ord-001',
  buyerId: BUYER_ID,
  sellerId: SELLER_ID,
  itemTitle: ITEM_TITLE,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('enqueueLocalScheduleNudge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses correct delay from platform_settings (24hr)', async () => {
    await enqueueLocalScheduleNudge(JOB_DATA);

    const callArgs = mockQueueAdd.mock.calls[0] as [string, JobData, { delay: number }];
    expect(callArgs[2]?.delay).toBe(24 * 60 * 60 * 1000);
  });

  it('reads scheduleReminderHours from platform_settings', async () => {
    await enqueueLocalScheduleNudge(JOB_DATA);

    expect(getPlatformSetting).toHaveBeenCalledWith('commerce.local.scheduleReminderHours', 24);
  });
});

describe('schedule-nudge worker — sends nudge when not confirmed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends nudge to both buyer and seller when scheduledAtConfirmedAt is null', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ status: 'SCHEDULED', scheduledAtConfirmedAt: null }]),
    );

    await processNudge({ data: JOB_DATA });

    expect(mockNotify).toHaveBeenCalledWith(BUYER_ID, 'local.schedule.reminder_setup', expect.objectContaining({ itemTitle: ITEM_TITLE }));
    expect(mockNotify).toHaveBeenCalledWith(SELLER_ID, 'local.schedule.reminder_setup', expect.objectContaining({ itemTitle: ITEM_TITLE }));
  });

  it('is a no-op when scheduledAtConfirmedAt is set', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ status: 'SCHEDULED', scheduledAtConfirmedAt: new Date() }]),
    );

    await processNudge({ data: JOB_DATA });

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('is a no-op when transaction is in terminal status (COMPLETED)', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ status: 'COMPLETED', scheduledAtConfirmedAt: new Date() }]),
    );

    await processNudge({ data: JOB_DATA });

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('is a no-op when transaction is CANCELED', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ status: 'CANCELED', scheduledAtConfirmedAt: null }]),
    );

    await processNudge({ data: JOB_DATA });

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('sends notification to BOTH buyer and seller (idempotent: running twice would notify twice, but that is acceptable per spec)', async () => {
    mockDbSelect.mockReturnValue(
      makeSelectChain([{ status: 'SCHEDULED', scheduledAtConfirmedAt: null }]),
    );

    await processNudge({ data: JOB_DATA });

    // Both parties must be notified
    const notifyCalls = mockNotify.mock.calls as Array<[string, string, Record<string, string>]>;
    const recipients = notifyCalls.map((c) => c[0]);
    expect(recipients).toContain(BUYER_ID);
    expect(recipients).toContain(SELLER_ID);
  });
});
