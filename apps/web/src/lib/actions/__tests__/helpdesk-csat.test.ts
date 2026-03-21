import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockDb = { insert: mockInsert, update: mockUpdate, select: mockSelect };
const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize, sub: (...args: unknown[]) => args }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Valid cuid2 IDs
const CASE_ID = 'cljd4bvd00000wjh07mcy26x';

function makeChain(returnVal: unknown) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnVal),
  };
  return chain;
}

describe('submitCsat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { submitCsat } = await import('../helpdesk-csat');
    const result = await submitCsat({ caseId: CASE_ID, rating: 5 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not authenticated');
  });

  it('returns validation error for out-of-range rating', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const { submitCsat } = await import('../helpdesk-csat');
    const result = await submitCsat({ caseId: CASE_ID, rating: 6 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns not found when case does not exist', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const selectChain = makeChain([]);
    mockSelect.mockReturnValue(selectChain);

    const { submitCsat } = await import('../helpdesk-csat');
    const result = await submitCsat({ caseId: CASE_ID, rating: 4 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns error when case is not RESOLVED', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    const caseChain = makeChain([{ requesterId: 'user-1', status: 'OPEN' }]);
    mockSelect.mockReturnValue(caseChain);

    const { submitCsat } = await import('../helpdesk-csat');
    const result = await submitCsat({ caseId: CASE_ID, rating: 5 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('resolved');
  });

  it('rejects submission when CSAT already responded', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(
          callCount === 1
            ? [{ requesterId: 'user-1', status: 'RESOLVED' }]
            : callCount === 2
            ? [{ id: 'csat-1' }]
            : [{ respondedAt: new Date() }]
        ),
      };
      return chain;
    });

    const { submitCsat } = await import('../helpdesk-csat');
    const result = await submitCsat({ caseId: CASE_ID, rating: 5 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already submitted');
  });

  it('creates new CSAT record for unrated case', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: { can: vi.fn().mockReturnValue(true) } });

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(
          callCount === 1
            ? [{ requesterId: 'user-1', status: 'RESOLVED' }]
            : [] // No existing CSAT
        ),
      };
      return chain;
    });

    const insertChain = {
      values: vi.fn().mockResolvedValue([]),
    };
    mockInsert.mockReturnValue(insertChain);

    const { submitCsat } = await import('../helpdesk-csat');
    const result = await submitCsat({ caseId: CASE_ID, rating: 5, comment: 'Great support!' });
    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });
});
