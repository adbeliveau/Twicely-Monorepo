import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockWorkerClose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd }),
  createWorker: vi.fn().mockReturnValue({ close: mockWorkerClose }),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(24),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { enqueueNoshowRelistCheck } from '../local-fraud-noshow-relist';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TX_ID = 'lt-test-001';
const SELLER_ID = 'seller-test-001';
const ORDER_ID = 'ord-test-001';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('enqueueNoshowRelistCheck', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPlatformSetting).mockResolvedValue(24 as never);
    mockQueueAdd.mockResolvedValue(undefined);
  });

  it('enqueues a job on the local-fraud-noshow-relist queue', async () => {
    await enqueueNoshowRelistCheck(TX_ID, SELLER_ID, ORDER_ID);

    expect(mockQueueAdd).toHaveBeenCalledOnce();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'check',
      expect.objectContaining({
        localTransactionId: TX_ID,
        sellerId: SELLER_ID,
        orderId: ORDER_ID,
      }),
      expect.objectContaining({ delay: expect.any(Number) }),
    );
  });

  it('computes delay as 24 * 60 * 60 * 1000ms from platform setting', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(24 as never);

    await enqueueNoshowRelistCheck(TX_ID, SELLER_ID, ORDER_ID);

    const opts = mockQueueAdd.mock.calls[0]?.[2] as { delay: number };
    expect(opts.delay).toBe(24 * 60 * 60 * 1000); // 86_400_000 ms
  });

  it('uses platform setting value for delay — uses 1hr when setting = 1', async () => {
    vi.mocked(getPlatformSetting).mockResolvedValue(1 as never);

    await enqueueNoshowRelistCheck(TX_ID, SELLER_ID, ORDER_ID);

    const opts = mockQueueAdd.mock.calls[0]?.[2] as { delay: number };
    expect(opts.delay).toBe(1 * 60 * 60 * 1000); // 3_600_000 ms
  });

  it('uses a deduplication jobId based on localTransactionId', async () => {
    await enqueueNoshowRelistCheck(TX_ID, SELLER_ID, ORDER_ID);

    const opts = mockQueueAdd.mock.calls[0]?.[2] as { jobId: string };
    expect(opts.jobId).toBe(`fraud-noshow-relist-${TX_ID}`);
  });

  it('sets removeOnComplete: true', async () => {
    await enqueueNoshowRelistCheck(TX_ID, SELLER_ID, ORDER_ID);

    const opts = mockQueueAdd.mock.calls[0]?.[2] as { removeOnComplete: boolean };
    expect(opts.removeOnComplete).toBe(true);
  });

  it('reads platform setting commerce.local.fraudNoshowRelistCheckHours', async () => {
    await enqueueNoshowRelistCheck(TX_ID, SELLER_ID, ORDER_ID);

    expect(vi.mocked(getPlatformSetting)).toHaveBeenCalledWith(
      'commerce.local.fraudNoshowRelistCheckHours',
      24,
    );
  });

  it('passes correct job data with all three required fields', async () => {
    const txId = 'lt-data-check';
    const sellerId = 'seller-data-check';
    const orderId = 'ord-data-check';

    await enqueueNoshowRelistCheck(txId, sellerId, orderId);

    const data = mockQueueAdd.mock.calls[0]?.[1] as Record<string, string>;
    expect(data.localTransactionId).toBe(txId);
    expect(data.sellerId).toBe(sellerId);
    expect(data.orderId).toBe(orderId);
  });
});
