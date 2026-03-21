import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  caseWatcher: { caseId: 'case_id', staffUserId: 'staff_user_id' },
  helpdeskCase: { id: 'id', caseNumber: 'case_number', subject: 'subject' },
}));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));

// eq/and/ne return opaque values in tests — just return the arg
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ eq: true })),
  ne: vi.fn((_col: unknown, _val: unknown) => ({ ne: true })),
  and: vi.fn((...args: unknown[]) => args),
}));

const WATCHERS = [
  { staffUserId: 'staff-1' },
  { staffUserId: 'staff-2' },
  { staffUserId: 'staff-3' },
];

const CASE_RECORD = {
  caseNumber: 'HD-100',
  subject: 'Test case subject',
};

function makeSelectChain(rows: unknown[]) {
  const resolvedChain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  resolvedChain.from.mockReturnValue(resolvedChain);
  resolvedChain.where.mockReturnValue(resolvedChain);
  return resolvedChain;
}

describe('notifyCaseWatchers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls notify for each watcher', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain(WATCHERS))
      .mockReturnValueOnce(makeSelectChain([CASE_RECORD]));
    const { notifyCaseWatchers } = await import('../notify-watchers');
    await notifyCaseWatchers('case-abc', '', 'New reply sent');
    expect(mockNotify).toHaveBeenCalledTimes(3);
  });

  it('excludes the acting agent from notification', async () => {
    const filteredWatchers = WATCHERS.filter((w) => w.staffUserId !== 'staff-1');
    mockSelect
      .mockReturnValueOnce(makeSelectChain(filteredWatchers))
      .mockReturnValueOnce(makeSelectChain([CASE_RECORD]));
    const { notifyCaseWatchers } = await import('../notify-watchers');
    await notifyCaseWatchers('case-abc', 'staff-1', 'New reply sent');
    expect(mockNotify).toHaveBeenCalledTimes(2);
    const calledUserIds = mockNotify.mock.calls.map((c) => c[0] as string);
    expect(calledUserIds).not.toContain('staff-1');
  });

  it('does nothing when no watchers exist', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([CASE_RECORD]));
    const { notifyCaseWatchers } = await import('../notify-watchers');
    await notifyCaseWatchers('case-abc', 'staff-1', 'New reply sent');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('passes correct template variables', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ staffUserId: 'staff-2' }]))
      .mockReturnValueOnce(makeSelectChain([CASE_RECORD]));
    const { notifyCaseWatchers } = await import('../notify-watchers');
    await notifyCaseWatchers('case-abc', '', 'Status changed to RESOLVED');
    expect(mockNotify).toHaveBeenCalledWith(
      'staff-2',
      'helpdesk.case.watcher_update',
      expect.objectContaining({
        caseNumber: 'HD-100',
        subject: 'Test case subject',
        eventDescription: 'Status changed to RESOLVED',
        caseUrl: '/hd/cases/case-abc',
      })
    );
  });

  it('handles missing case gracefully — returns without notifying', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain(WATCHERS))
      .mockReturnValueOnce(makeSelectChain([]));
    const { notifyCaseWatchers } = await import('../notify-watchers');
    await notifyCaseWatchers('case-nonexistent', '', 'New reply sent');
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
