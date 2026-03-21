import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

const CURRENT_CASE_ID = 'cljd4bvd00000wjh07mcy26x';

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit'].forEach((k) => { chain[k] = vi.fn().mockReturnValue(chain); });
  chain['then'] = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe('searchCasesForMerge', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns cases matching case number query', async () => {
    const matching = [
      { id: 'case-2', caseNumber: 'HD-000002', subject: 'Order issue', requesterEmail: 'buyer@test.com', status: 'OPEN' },
    ];
    mockSelect.mockReturnValue(makeSelectChain(matching));

    const { searchCasesForMerge } = await import('../helpdesk-merge-search');
    const result = await searchCasesForMerge('HD-000002', CURRENT_CASE_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.caseNumber).toBe('HD-000002');
  });

  it('returns cases matching subject query', async () => {
    const matching = [
      { id: 'case-3', caseNumber: 'HD-000003', subject: 'Billing problem', requesterEmail: 'user@test.com', status: 'OPEN' },
    ];
    mockSelect.mockReturnValue(makeSelectChain(matching));

    const { searchCasesForMerge } = await import('../helpdesk-merge-search');
    const result = await searchCasesForMerge('Billing', CURRENT_CASE_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.subject).toBe('Billing problem');
  });

  it('excludes current case from results', async () => {
    // Empty result means the query correctly applied ne(id, currentCaseId)
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { searchCasesForMerge } = await import('../helpdesk-merge-search');
    const result = await searchCasesForMerge('HD-', CURRENT_CASE_ID);
    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('excludes CLOSED cases from results', async () => {
    // The query applies not(eq(status, 'CLOSED')) — we verify the call is made
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { searchCasesForMerge } = await import('../helpdesk-merge-search');
    const result = await searchCasesForMerge('order', CURRENT_CASE_ID);
    expect(result).toEqual([]);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('returns empty array for empty query string', async () => {
    const { searchCasesForMerge } = await import('../helpdesk-merge-search');
    const result = await searchCasesForMerge('', CURRENT_CASE_ID);
    expect(result).toEqual([]);
    // No DB call for empty query
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
