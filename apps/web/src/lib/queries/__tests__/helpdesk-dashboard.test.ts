import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  return { mockSelect };
});

vi.mock('@twicely/db', () => ({ db: { select: mockSelect } }));

import { getHelpdeskDashboardStats } from '../helpdesk-dashboard';
import { getHelpdeskDashboardDeltas } from '../helpdesk-dashboard-deltas';
import { getHelpdeskRecentActivity } from '../helpdesk-activity';

function makeCountChain(countValue: number) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) =>
      Promise.resolve([{ count: countValue }]).then(resolve),
  };
  ['from', 'where', 'innerJoin', 'leftJoin', 'groupBy', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeRowChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'innerJoin', 'leftJoin', 'groupBy', 'orderBy', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

// getHelpdeskDashboardStats makes 9 parallel queries:
// 1=openCount, 2=resolvedToday, 3=slaBreached, 4=avgResponse,
// 5=csatAvg, 6=avgResolution, 7=slaCompliance, 8=slaFirstResponse, 9=slaResolution

describe('getHelpdeskDashboardStats', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns CSAT score from caseCsat records', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeCountChain(5);   // open
      if (call === 2) return makeCountChain(3);   // resolvedToday
      if (call === 3) return makeCountChain(1);   // slaBreached
      if (call === 4) return makeRowChain([{ avgMinutes: 15 }]); // avgResponse
      if (call === 5) return makeRowChain([{ avgRating: 4.2, responseCount: 8 }]); // csat
      if (call === 6) return makeRowChain([{ avgMinutes: 120 }]); // avgResolution
      if (call === 7) return makeRowChain([{ compliant: 9, total: 10 }]); // slaCompliance
      if (call === 8) return makeRowChain([{ compliant: 8, total: 10 }]); // slaFirstResponse
      return makeRowChain([{ compliant: 7, total: 10 }]); // slaResolution
    });

    const result = await getHelpdeskDashboardStats();
    expect(result.csatScore).toBe(4.2);
    expect(result.csatCount).toBe(8);
  });

  it('returns null csatScore when no CSAT records exist', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeRowChain([{ avgRating: null, responseCount: 0 }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardStats();
    expect(result.csatScore).toBeNull();
    expect(result.csatCount).toBe(0);
  });

  it('excludes CSAT records where respondedAt is null (responseCount=0 = null score)', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeRowChain([{ avgRating: 3.5, responseCount: 0 }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardStats();
    // When responseCount is 0 the query filtered out nulls — csatScore should be null
    expect(result.csatScore).toBeNull();
  });

  it('calculates avgResolutionMinutes correctly', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 6) return makeRowChain([{ avgMinutes: 240 }]);
      if (call === 5) return makeRowChain([{ avgRating: null, responseCount: 0 }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardStats();
    expect(result.avgResolutionMinutes).toBe(240);
  });

  it('calculates slaCompliancePct correctly', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeRowChain([{ avgRating: null, responseCount: 0 }]);
      if (call === 6) return makeRowChain([{ avgMinutes: 0 }]);
      if (call === 7) return makeRowChain([{ compliant: 8, total: 10 }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardStats();
    expect(result.slaCompliancePct).toBe(80);
  });

  it('returns 100% SLA compliance when no cases in period', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeRowChain([{ avgRating: null, responseCount: 0 }]);
      if (call === 6) return makeRowChain([{ avgMinutes: 0 }]);
      if (call === 7) return makeRowChain([{ compliant: 0, total: 0 }]);
      if (call === 8) return makeRowChain([{ compliant: 0, total: 0 }]);
      if (call === 9) return makeRowChain([{ compliant: 0, total: 0 }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardStats();
    expect(result.slaCompliancePct).toBe(100);
    expect(result.slaFirstResponsePct).toBe(100);
    expect(result.slaResolutionPct).toBe(100);
  });

  it('returns slaFirstResponsePct and slaResolutionPct', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeRowChain([{ avgRating: null, responseCount: 0 }]);
      if (call === 6) return makeRowChain([{ avgMinutes: 0 }]);
      if (call === 7) return makeRowChain([{ compliant: 9, total: 10 }]);
      if (call === 8) return makeRowChain([{ compliant: 6, total: 10 }]);
      if (call === 9) return makeRowChain([{ compliant: 7, total: 10 }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardStats();
    expect(result.slaFirstResponsePct).toBe(60);
    expect(result.slaResolutionPct).toBe(70);
  });
});

// getHelpdeskDashboardDeltas makes 8 parallel queries:
// 1=resolvedToday, 2=resolvedYesterday, 3=breachedToday, 4=breachedYesterday,
// 5=avgResponseCurrent, 6=avgResponsePrev, 7=csatCurrent, 8=csatPrev

describe('getHelpdeskDashboardDeltas', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns positive resolvedTodayDelta when today > yesterday', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeCountChain(5);  // resolvedToday
      if (call === 2) return makeCountChain(3);  // resolvedYesterday
      if (call === 3) return makeCountChain(2);  // breachedToday
      if (call === 4) return makeCountChain(1);  // breachedYesterday
      if (call === 5) return makeRowChain([{ avgMinutes: 30 }]); // avgCurrent
      if (call === 6) return makeRowChain([{ avgMinutes: 25 }]); // avgPrev
      if (call === 7) return makeRowChain([{ avgRating: 4.5 }]); // csatCurrent
      return makeRowChain([{ avgRating: 4.2 }]); // csatPrev
    });

    const result = await getHelpdeskDashboardDeltas();
    expect(result.resolvedTodayDelta).toBe(2);
  });

  it('returns negative resolvedTodayDelta when today < yesterday', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeCountChain(2);  // resolvedToday
      if (call === 2) return makeCountChain(6);  // resolvedYesterday
      if (call === 5) return makeRowChain([{ avgMinutes: null }]);
      if (call === 6) return makeRowChain([{ avgMinutes: null }]);
      if (call === 7) return makeRowChain([{ avgRating: null }]);
      if (call === 8) return makeRowChain([{ avgRating: null }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardDeltas();
    expect(result.resolvedTodayDelta).toBe(-4);
  });

  it('returns 0 delta when both periods are equal', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeCountChain(4);
      if (call === 2) return makeCountChain(4);
      if (call === 5) return makeRowChain([{ avgMinutes: null }]);
      if (call === 6) return makeRowChain([{ avgMinutes: null }]);
      if (call === 7) return makeRowChain([{ avgRating: null }]);
      if (call === 8) return makeRowChain([{ avgRating: null }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardDeltas();
    expect(result.resolvedTodayDelta).toBe(0);
  });

  it('returns null CSAT delta when no prior period data', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 5) return makeRowChain([{ avgMinutes: null }]);
      if (call === 6) return makeRowChain([{ avgMinutes: null }]);
      if (call === 7) return makeRowChain([{ avgRating: 4.0 }]); // current has data
      if (call === 8) return makeRowChain([{ avgRating: null }]); // prev has none
      return makeCountChain(0);
    });

    const result = await getHelpdeskDashboardDeltas();
    expect(result.csatDelta).toBeNull();
  });
});

// getHelpdeskRecentActivity — uses innerJoin + leftJoin
describe('getHelpdeskRecentActivity', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves agent IDs to staff display names', async () => {
    const now = new Date();
    mockSelect.mockReturnValue(makeRowChain([
      {
        eventType: 'status_changed', actorId: 'staff-001', actorType: 'agent',
        caseId: 'case-1', dataJson: {}, createdAt: now,
        caseNumber: 'TW-0001', staffName: 'Alice Smith', userName: null,
      },
    ]));

    const result = await getHelpdeskRecentActivity();
    expect(result[0]?.agent).toBe('Alice Smith');
  });

  it('resolves caseId to caseNumber', async () => {
    const now = new Date();
    mockSelect.mockReturnValue(makeRowChain([
      {
        eventType: 'created', actorId: 'user-001', actorType: 'user',
        caseId: 'case-abc123', dataJson: {}, createdAt: now,
        caseNumber: 'TW-0042', staffName: null, userName: 'Bob Jones',
      },
    ]));

    const result = await getHelpdeskRecentActivity();
    expect(result[0]?.caseNumber).toBe('TW-0042');
  });

  it('shows System for system-generated events', async () => {
    const now = new Date();
    mockSelect.mockReturnValue(makeRowChain([
      {
        eventType: 'created', actorId: null, actorType: 'system',
        caseId: 'case-1', dataJson: {}, createdAt: now,
        caseNumber: 'TW-0010', staffName: null, userName: null,
      },
    ]));

    const result = await getHelpdeskRecentActivity();
    expect(result[0]?.agent).toBe('System');
  });
});
