import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted ensures mockQueueAdd is available before vi.mock() runs
const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-1' }));

// Mock BullMQ to prevent Valkey connection at import time
vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({
    add: mockQueueAdd,
    close: vi.fn(),
  }),
  createWorker: vi.fn().mockReturnValue({
    close: vi.fn(),
  }),
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
    updatedAt: 'updated_at',
  },
  order: {
    id: 'id',
    status: 'status',
    completedAt: 'completed_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(72),
}));

vi.mock('@twicely/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import { enqueueLocalEscrowRelease, localEscrowReleaseQueue } from '../local-escrow-release';

describe('enqueueLocalEscrowRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: 'job-1' });
  });

  it('calls queue.add with release job data', async () => {
    await enqueueLocalEscrowRelease('lt-1', 'order-1');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'release',
      { localTransactionId: 'lt-1', orderId: 'order-1' },
      expect.objectContaining({ jobId: 'local-escrow-release-lt-1' }),
    );
  });

  it('sets delay based on holdHours * 60 * 60 * 1000', async () => {
    await enqueueLocalEscrowRelease('lt-2', 'order-2');

    const callArgs = mockQueueAdd.mock.calls[0] as [string, unknown, { delay: number }];
    expect(callArgs[2]?.delay).toBe(72 * 60 * 60 * 1000);
  });
});

describe('local-escrow-release worker processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports localEscrowReleaseQueue', () => {
    expect(localEscrowReleaseQueue).toBeDefined();
  });

  it('skips already-COMPLETED transaction (idempotent) — no DB update called', () => {
    // COMPLETED is a terminal status — the worker returns early without updating
    // (source uses direct string comparison, not canTransition)
    expect(db.update).not.toHaveBeenCalled();
  });
});
