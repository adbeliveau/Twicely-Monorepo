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
  return {
    session: { staffUserId: STAFF_ID, displayName: 'Agent One', email: 'agent@twicely.co', isPlatformStaff: true as const, platformRoles: [] },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => { chain[k] = vi.fn().mockReturnValue(chain); });
  chain['then'] = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeWriteChain() {
  const chain: Record<string, unknown> = {};
  ['values', 'set', 'where'].forEach((k) => { chain[k] = vi.fn().mockReturnThis(); });
  (chain as Record<string, unknown>)['then'] = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
  return chain;
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

// Validation, auth and early-exit tests
describe('mergeCases — validation', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('requires staff authorization', async () => {
    mockStaffAuthorize.mockRejectedValue(new Error('Forbidden'));
    await expect(mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID })).rejects.toThrow('Forbidden');
  });

  it('rejects merge into self', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: SOURCE_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/itself/i);
  });

  it('returns error for non-existent source case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([]);
      return makeSelectChain([targetCaseRow]);
    });
    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/source/i);
  });

  it('returns error for non-existent target case', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      return makeSelectChain([]);
    });
    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/target/i);
  });

  it('rejects merge into CLOSED target', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const closedTarget = { ...targetCaseRow, status: 'CLOSED' };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      return makeSelectChain([closedTarget]);
    });
    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/closed/i);
  });

  it('rejects merge of already-merged source', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    const alreadyMergedSource = { ...sourceCaseRow, mergedIntoCaseId: 'some-other-case-id' };
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([alreadyMergedSource]);
      return makeSelectChain([targetCaseRow]);
    });
    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already been merged/i);
  });

  it('rejects merge when target has 5+ merged sources', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      return makeSelectChain([{ count: 5 }]);
    });
    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/5/);
  });

  it('successfully merges source into target', async () => {
    mockStaffAuthorize.mockResolvedValue(makeStaffSession());
    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([sourceCaseRow]);
      if (callCount === 2) return makeSelectChain([targetCaseRow]);
      if (callCount === 3) return makeSelectChain([{ count: 0 }]);
      return makeSelectChain([]);
    });
    const insertChain = makeWriteChain();
    mockInsert.mockReturnValue(insertChain);
    const updateChain = makeWriteChain();
    mockUpdate.mockReturnValue(updateChain);

    const result = await mergeCases({ sourceCaseId: SOURCE_ID, targetCaseId: TARGET_ID });
    expect(result.success).toBe(true);
  });
});
