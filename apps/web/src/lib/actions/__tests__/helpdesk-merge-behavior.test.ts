import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInsert, mockUpdate, mockSelect, mockStaffAuthorize, mockRevalidatePath } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockStaffAuthorize: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { insert: mockInsert, update: mockUpdate, select: mockSelect },
}));
vi.mock('@twicely/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import { mergeCases } from '../helpdesk-merge';

// Valid cuid2 IDs
const SOURCE_ID = 'cljd4bvd00000wjh07mcy26x';
const TARGET_ID = 'cljd4bvd00001wjh07mcy26y';
const STAFF_ID = 'cljd4bvd00002wjh07mcy26z';

function makeStaffSession() {
  return { session: { staffUserId: STAFF_ID, displayName: 'Agent One', email: 'agent@twicely.co', isPlatformStaff: true as const, platformRoles: [] }, ability: { can: vi.fn().mockReturnValue(true) } };
}

function makeSelectChain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => { c[k] = vi.fn().mockReturnValue(c); });
  c['then'] = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return c;
}
function makeWriteChain() {
  const c: Record<string, unknown> = {};
  ['values', 'set', 'where'].forEach((k) => { c[k] = vi.fn().mockReturnThis(); });
  c['then'] = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
  return c;
}
function setupWriteMocks() {
  const insertChain = makeWriteChain();
  mockInsert.mockReturnValue(insertChain);
  const updateChain = makeWriteChain();
  mockUpdate.mockReturnValue(updateChain);
  return { insertChain, updateChain };
}

const sourceCaseRow = {
  id: SOURCE_ID, caseNumber: 'HD-000010', subject: 'Source case', status: 'OPEN',
  mergedIntoCaseId: null, tags: ['billing'], assignedTeamId: null,
  orderId: null, listingId: null, sellerId: null, payoutId: null, disputeCaseId: null, returnRequestId: null,
};
const targetCaseRow = {
  id: TARGET_ID, caseNumber: 'HD-000020', subject: 'Target case', status: 'OPEN',
  mergedIntoCaseId: null, tags: ['refund'], assignedTeamId: null,
  orderId: null, listingId: null, sellerId: null, payoutId: null, disputeCaseId: null, returnRequestId: null,
};

// Merge behavior tests — message/event copying, watchers, tags, and state changes
describe('mergeCases — behavior', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('copies all messages from source to target with fromMergedCaseId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const sourceMsg = { id: 'msg-1', caseId: SOURCE_ID, senderType: 'user', senderId: 'u1', senderName: 'Alice', direction: 'INBOUND', body: 'Hello', bodyHtml: null, attachments: [], deliveryStatus: 'SENT', emailMessageId: null, fromMergedCaseId: null, createdAt: new Date('2026-01-01T09:00:00Z') };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      if (callCount === 4) return makeSelectChain([sourceMsg]);
      return makeSelectChain([]);
    });
    const { insertChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const firstInsertCall = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{ fromMergedCaseId: string; caseId: string }>;
    expect(firstInsertCall).toBeDefined();
    const firstMsg = Array.isArray(firstInsertCall) ? firstInsertCall[0] : firstInsertCall;
    expect(firstMsg?.fromMergedCaseId).toBe(SOURCE_ID);
    expect(firstMsg?.caseId).toBe(TARGET_ID);
  });

  it('preserves original createdAt on copied messages', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const originalDate = new Date('2026-01-01T09:00:00Z');
    const sourceMsg = { id: 'msg-1', caseId: SOURCE_ID, senderType: 'user', senderId: 'u1', senderName: 'Alice', direction: 'INBOUND', body: 'Hello', bodyHtml: null, attachments: [], deliveryStatus: 'SENT', emailMessageId: null, fromMergedCaseId: null, createdAt: originalDate };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      if (callCount === 4) return makeSelectChain([sourceMsg]);
      return makeSelectChain([]);
    });
    const { insertChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const firstInsertCall = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Array<{ createdAt: Date }>;
    const copiedMsg = Array.isArray(firstInsertCall) ? firstInsertCall[0] : firstInsertCall;
    expect(copiedMsg?.createdAt).toEqual(originalDate);
  });

  it('copies all events from source to target with fromMergedCaseId', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const sourceEvt = { id: 'evt-1', caseId: SOURCE_ID, eventType: 'created', actorType: 'user', actorId: 'u1', dataJson: {}, fromMergedCaseId: null, createdAt: new Date() };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      if (callCount === 4) return makeSelectChain([]);
      if (callCount === 5) return makeSelectChain([sourceEvt]);
      return makeSelectChain([]);
    });
    setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    expect(mockInsert).toHaveBeenCalled();
  });

  it('does not copy duplicate watchers', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const watcher = { id: 'w-1', caseId: SOURCE_ID, staffUserId: STAFF_ID, createdAt: new Date() };
    const existingWatcher = { id: 'w-2', caseId: TARGET_ID, staffUserId: STAFF_ID, createdAt: new Date() };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      if (callCount === 4) return makeSelectChain([]);
      if (callCount === 5) return makeSelectChain([]);
      if (callCount === 6) return makeSelectChain([watcher]);
      if (callCount === 7) return makeSelectChain([existingWatcher]);
      return makeSelectChain([]);
    });
    const { insertChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const insertCalls = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of insertCalls) {
      const arg = call[0];
      if (Array.isArray(arg)) {
        for (const item of arg) {
          if ('staffUserId' in (item as Record<string, unknown>)) {
            expect((item as { caseId: string }).caseId).not.toBe(TARGET_ID);
          }
        }
      }
    }
  });

  it('unions tags from source into target', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    const { updateChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const updateSetCalls = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls;
    const targetUpdateCall = updateSetCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return Array.isArray(arg?.tags);
    });
    expect(targetUpdateCall).toBeDefined();
    const tags = (targetUpdateCall?.[0] as { tags: string[] })?.tags ?? [];
    expect(tags).toContain('billing');
    expect(tags).toContain('refund');
  });

  it('closes source case after merge', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    const { updateChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const setCall = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg?.status === 'CLOSED';
    });
    expect(setCall).toBeDefined();
    expect((setCall?.[0] as Record<string, unknown>)?.mergedIntoCaseId).toBe(TARGET_ID);
  });

  it('sets mergedIntoCaseId on source case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    const { updateChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const mergeUpdateCall = (updateChain.set as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) => {
      return (c[0] as Record<string, unknown>)?.mergedIntoCaseId === TARGET_ID;
    });
    expect(mergeUpdateCall).toBeDefined();
  });

  it('creates merged_into event on source case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    const { insertChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const insertCalls = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls;
    const mergedIntoEvent = insertCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg?.eventType === 'merged_into';
    });
    expect(mergedIntoEvent).toBeDefined();
    expect((mergedIntoEvent?.[0] as { caseId: string })?.caseId).toBe(SOURCE_ID);
  });

  it('creates merged_from event on target case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    const { insertChain } = setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    const insertCalls = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls;
    const mergedFromEvent = insertCalls.find((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      return arg?.eventType === 'merged_from';
    });
    expect(mergedFromEvent).toBeDefined();
    expect((mergedFromEvent?.[0] as { caseId: string })?.caseId).toBe(TARGET_ID);
  });

  it('revalidates paths for both cases', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    setupWriteMocks();

    await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });

    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hd/cases/${SOURCE_ID}`);
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/hd/cases/${TARGET_ID}`);
  });
});
