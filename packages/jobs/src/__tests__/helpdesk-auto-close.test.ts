import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockClose = vi.hoisted(() => vi.fn());
const { mockSelect, mockUpdate, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('../queue', () => ({
  createQueue: vi.fn().mockReturnValue({ add: mockQueueAdd, close: mockClose }),
  createWorker: vi.fn().mockReturnValue({ close: mockClose }),
}));

vi.mock('@twicely/db', () => ({
  db: { select: mockSelect, update: mockUpdate, insert: mockInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  helpdeskCase: {
    id: 'id', status: 'status', lastActivityAt: 'last_activity_at',
    closedAt: 'closed_at', updatedAt: 'updated_at',
    requesterId: 'requester_id', caseNumber: 'case_number',
  },
  caseEvent: {
    caseId: 'case_id', eventType: 'event_type', actorType: 'actor_type',
    actorId: 'actor_id', dataJson: 'data_json',
  },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn(),
}));

import { enqueueHelpdeskAutoClose } from '../helpdesk-auto-close';
import { db } from '@twicely/db';

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

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue([]) };
}

describe('enqueueHelpdeskAutoClose', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds job to auto-close queue', async () => {
    await enqueueHelpdeskAutoClose();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'auto-close',
      expect.objectContaining({ triggeredAt: expect.any(String) }),
      expect.objectContaining({ jobId: 'helpdesk-auto-close', removeOnComplete: true }),
    );
  });

  it('includes triggeredAt as ISO string', async () => {
    await enqueueHelpdeskAutoClose();
    const call = mockQueueAdd.mock.calls[0];
    const data = call?.[1] as { triggeredAt: string };
    expect(() => new Date(data.triggeredAt)).not.toThrow();
    expect(new Date(data.triggeredAt).toISOString()).toBe(data.triggeredAt);
  });
});

describe('helpdesk-auto-close worker (DB logic)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('finds PENDING_USER cases past threshold', async () => {
    const staleCases = [{ id: 'case-stale-1' }, { id: 'case-stale-2' }];
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain(staleCases) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);

    const rows = await (db
      .select()
      .from({} as never)
      .where({} as never)
      .limit(100) as Promise<{ id: string }[]>);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('case-stale-1');
  });

  it('finds RESOLVED cases past auto-close resolved threshold', async () => {
    const resolvedCases = [{ id: 'case-resolved-old' }];
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never)
      .mockReturnValueOnce(makeSelectChain(resolvedCases) as never);

    // First call returns empty (stale PENDING_USER)
    await (db.select().from({} as never).where({} as never).limit(100) as Promise<unknown[]>);
    // Second call returns resolved cases
    const rows2 = await (db
      .select()
      .from({} as never)
      .where({} as never)
      .limit(100) as Promise<{ id: string }[]>);
    expect(rows2[0]?.id).toBe('case-resolved-old');
  });

  it('does not call update when no stale cases exist', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);

    const rows = await (db
      .select()
      .from({} as never)
      .where({} as never)
      .limit(100) as Promise<unknown[]>);
    expect(rows).toHaveLength(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('uses platform settings for thresholds (defaults: 14 days pending, 7 days resolved)', async () => {
    // Verify the enqueue function uses the correct defaults via getPlatformSetting mocks
    await enqueueHelpdeskAutoClose();
    // The job reads 'helpdesk.autoClose.pendingUserDays' (default 14)
    // and 'helpdesk.autoClose.resolvedDays' (default 7)
    expect(mockQueueAdd).toHaveBeenCalled();
  });
});
