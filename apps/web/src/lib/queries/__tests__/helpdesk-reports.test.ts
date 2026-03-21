import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  return { mockSelect };
});

vi.mock('@twicely/db', () => ({ db: { select: mockSelect } }));

import {
  getHelpdeskReportMetrics,
  getHelpdeskVolumeTimeseries,
  getHelpdeskCasesByType,
  getHelpdeskCasesByChannel,
  getHelpdeskAgentPerformance,
} from '../helpdesk-reports';

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

const testRange = {
  from: new Date('2026-01-01T00:00:00.000Z'),
  to: new Date('2026-01-31T23:59:59.999Z'),
};

// getHelpdeskReportMetrics makes 6 parallel queries:
// 1=openCount, 2=avgFirstResponse, 3=avgResolution, 4=slaCompliance, 5=csat, 6=resolvedCount

describe('getHelpdeskReportMetrics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns correct counts for given date range', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) return makeCountChain(12);  // openCases
      if (call === 2) return makeRowChain([{ avgMinutes: 45 }]); // avgFirstResponse
      if (call === 3) return makeRowChain([{ avgMinutes: 300 }]); // avgResolution
      if (call === 4) return makeRowChain([{ compliant: 8, total: 10 }]); // sla
      if (call === 5) return makeRowChain([{ avgRating: 4.3 }]); // csat
      return makeCountChain(20); // resolvedCount
    });

    const result = await getHelpdeskReportMetrics(testRange);
    expect(result.openCases).toBe(12);
    expect(result.avgFirstResponseMinutes).toBe(45);
    expect(result.avgResolutionMinutes).toBe(300);
    expect(result.slaCompliancePct).toBe(80);
    expect(result.csatScore).toBe(4.3);
    expect(result.resolvedCount).toBe(20);
  });

  it('returns null csatScore when no responses in range', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 4) return makeRowChain([{ compliant: 0, total: 0 }]);
      if (call === 5) return makeRowChain([{ avgRating: null }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskReportMetrics(testRange);
    expect(result.csatScore).toBeNull();
  });

  it('calculates SLA compliance correctly', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 4) return makeRowChain([{ compliant: 3, total: 4 }]);
      if (call === 5) return makeRowChain([{ avgRating: null }]);
      return makeCountChain(0);
    });

    const result = await getHelpdeskReportMetrics(testRange);
    expect(result.slaCompliancePct).toBe(75);
  });
});

// getHelpdeskVolumeTimeseries — uses 2 parallel queries

describe('getHelpdeskVolumeTimeseries', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns daily created/resolved counts', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) {
        return makeRowChain([
          { date: '2026-01-01', count: 3 },
          { date: '2026-01-02', count: 5 },
        ]);
      }
      return makeRowChain([
        { date: '2026-01-01', count: 1 },
      ]);
    });

    const range = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-02T23:59:59.999Z'),
    };
    const result = await getHelpdeskVolumeTimeseries(range);
    expect(result).toHaveLength(2);
    const day1 = result.find((d) => d.date === '2026-01-01');
    expect(day1?.created).toBe(3);
    expect(day1?.resolved).toBe(1);
    const day2 = result.find((d) => d.date === '2026-01-02');
    expect(day2?.created).toBe(5);
    expect(day2?.resolved).toBe(0);
  });

  it('fills zero-count days in the range', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      // Return data only for first day; other days get zeros
      if (call === 1) return makeRowChain([{ date: '2026-01-01', count: 2 }]);
      return makeRowChain([]);
    });

    const range = {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-03T23:59:59.999Z'),
    };
    const result = await getHelpdeskVolumeTimeseries(range);
    // All days in range should be present
    expect(result).toHaveLength(3);
    const day2 = result.find((d) => d.date === '2026-01-02');
    expect(day2?.created).toBe(0);
    expect(day2?.resolved).toBe(0);
  });
});

describe('getHelpdeskCasesByType', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('groups correctly by type', async () => {
    mockSelect.mockReturnValue(makeRowChain([
      { type: 'SUPPORT', count: 10 },
      { type: 'ORDER', count: 5 },
      { type: 'BILLING', count: 2 },
    ]));

    const result = await getHelpdeskCasesByType(testRange);
    expect(result).toHaveLength(3);
    expect(result.find((r) => r.type === 'SUPPORT')?.count).toBe(10);
    expect(result.find((r) => r.type === 'ORDER')?.count).toBe(5);
  });

  it('returns empty array when no cases in range', async () => {
    mockSelect.mockReturnValue(makeRowChain([]));

    const result = await getHelpdeskCasesByType(testRange);
    expect(result).toEqual([]);
  });
});

describe('getHelpdeskCasesByChannel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('groups correctly by channel', async () => {
    mockSelect.mockReturnValue(makeRowChain([
      { channel: 'WEB', count: 15 },
      { channel: 'EMAIL', count: 8 },
    ]));

    const result = await getHelpdeskCasesByChannel(testRange);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.channel === 'WEB')?.count).toBe(15);
    expect(result.find((r) => r.channel === 'EMAIL')?.count).toBe(8);
  });
});

// getHelpdeskAgentPerformance — makes 1 main query + optional CSAT query

describe('getHelpdeskAgentPerformance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns per-agent metrics with names', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) {
        return makeRowChain([
          {
            agentId: 'staff-001',
            agentName: 'Alice Smith',
            casesHandled: 10,
            avgResponseMinutes: 30,
            avgResolutionMinutes: 180,
          },
        ]);
      }
      // CSAT query
      return makeRowChain([
        { agentId: 'staff-001', avgRating: 4.5 },
      ]);
    });

    const result = await getHelpdeskAgentPerformance(testRange);
    expect(result).toHaveLength(1);
    expect(result[0]?.agentName).toBe('Alice Smith');
    expect(result[0]?.casesHandled).toBe(10);
    expect(result[0]?.avgResponseMinutes).toBe(30);
    expect(result[0]?.avgResolutionMinutes).toBe(180);
  });

  it('calculates per-agent CSAT from caseCsat join', async () => {
    let call = 0;
    mockSelect.mockImplementation(() => {
      call++;
      if (call === 1) {
        return makeRowChain([
          {
            agentId: 'staff-002',
            agentName: 'Bob Jones',
            casesHandled: 7,
            avgResponseMinutes: 20,
            avgResolutionMinutes: 90,
          },
        ]);
      }
      return makeRowChain([{ agentId: 'staff-002', avgRating: 3.8 }]);
    });

    const result = await getHelpdeskAgentPerformance(testRange);
    expect(result[0]?.csatScore).toBe(3.8);
  });

  it('returns empty array when no assigned cases', async () => {
    mockSelect.mockReturnValue(makeRowChain([]));

    const result = await getHelpdeskAgentPerformance(testRange);
    expect(result).toEqual([]);
  });
});
