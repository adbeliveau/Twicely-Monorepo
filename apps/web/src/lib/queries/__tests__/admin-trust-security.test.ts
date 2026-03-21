/**
 * Admin Trust Security & Risk Query Tests (I7)
 * Tests for getRiskSignals, getSecurityEvents, getSecurityEventKPIs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: (...args: unknown[]) => mockDbSelect(...args) } }));
vi.mock('@twicely/db/schema', () => ({
  sellerProfile: { enforcementLevel: 'enforcementLevel', bandOverride: 'bandOverride', trustScore: 'trustScore', id: 'id' },
  sellerPerformance: { defectRate: 'defectRate' },
  auditEvent: { action: 'action', severity: 'severity', createdAt: 'createdAt', id: 'id', actorType: 'actorType', actorId: 'actorId', subject: 'subject', subjectId: 'subjectId', detailsJson: 'detailsJson', ipAddress: 'ipAddress', userAgent: 'userAgent' },
}));
vi.mock('drizzle-orm', () => ({
  eq: () => ({ type: 'eq' }),
  desc: () => ({ type: 'desc' }),
  count: () => ({ type: 'count' }),
  lt: () => ({ type: 'lt' }),
  sql: Object.assign((parts: TemplateStringsArray, ..._rest: unknown[]) => parts[0], { raw: (s: string) => s }),
  and: (..._args: unknown[]) => ({ type: 'and' }),
  gte: () => ({ type: 'gte' }),
  like: () => ({ type: 'like' }),
}));

// ─── Chain Helper ─────────────────────────────────────────────────────────────

function chain(result: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const key of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'innerJoin', 'leftJoin', 'select']) {
    c[key] = vi.fn().mockReturnValue(c);
  }
  return c;
}

// ─── getRiskSignals ───────────────────────────────────────────────────────────

describe('getRiskSignals', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('counts restricted sellers correctly', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([{ cnt: 3 }]))   // lowTrust
      .mockReturnValueOnce(chain([{ cnt: 1 }]))   // preSuspension
      .mockReturnValueOnce(chain([{ cnt: 5 }]))   // restricted
      .mockReturnValueOnce(chain([{ cnt: 2 }]))   // highDefect
      .mockReturnValueOnce(chain([{ cnt: 4 }]))   // overrides
      .mockReturnValueOnce(chain([{ cnt: 0 }]));  // fraudFlags
    const { getRiskSignals } = await import('../admin-trust-security');
    const result = await getRiskSignals();
    expect(result.restrictedSellers).toBe(5);
  });

  it('counts low trust sellers below threshold', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([{ cnt: 8 }]))   // lowTrust < 40
      .mockReturnValueOnce(chain([{ cnt: 0 }]))
      .mockReturnValueOnce(chain([{ cnt: 0 }]))
      .mockReturnValueOnce(chain([{ cnt: 0 }]))
      .mockReturnValueOnce(chain([{ cnt: 0 }]))
      .mockReturnValueOnce(chain([{ cnt: 0 }]));
    const { getRiskSignals } = await import('../admin-trust-security');
    const result = await getRiskSignals();
    expect(result.lowTrustSellers).toBe(8);
  });
});

// ─── getSecurityEvents ────────────────────────────────────────────────────────

describe('getSecurityEvents', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  const NOW = new Date('2026-01-15T10:00:00Z');

  function makeEvent(id: string, severity = 'MEDIUM', actionStr = 'security.login.failed') {
    return { id, actorType: 'USER', actorId: 'u1', action: actionStr, subject: 'User', subjectId: null, severity, detailsJson: {}, ipAddress: '1.2.3.4', userAgent: 'Mozilla', createdAt: NOW };
  }

  it('filters by severity', async () => {
    const rows = [makeEvent('e1', 'CRITICAL')];
    mockDbSelect
      .mockReturnValueOnce(chain(rows))           // events
      .mockReturnValueOnce(chain([{ cnt: 1 }])); // total
    const { getSecurityEvents } = await import('../admin-trust-security');
    const { events, total } = await getSecurityEvents({ page: 1, pageSize: 20, severity: 'CRITICAL' });
    expect(events).toHaveLength(1);
    expect(total).toBe(1);
  });

  it('filters by action prefix', async () => {
    const rows = [makeEvent('e2', 'HIGH', 'security.fraud.flagged')];
    mockDbSelect
      .mockReturnValueOnce(chain(rows))
      .mockReturnValueOnce(chain([{ cnt: 1 }]));
    const { getSecurityEvents } = await import('../admin-trust-security');
    const { events } = await getSecurityEvents({ page: 1, pageSize: 20, action: 'security.fraud.flagged' });
    expect(events[0]?.action).toBe('security.fraud.flagged');
  });

  it('paginates correctly', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ cnt: 45 }]));
    const { getSecurityEvents } = await import('../admin-trust-security');
    const { total } = await getSecurityEvents({ page: 3, pageSize: 20 });
    expect(total).toBe(45);
  });
});

// ─── getSecurityEventKPIs ─────────────────────────────────────────────────────

describe('getSecurityEventKPIs', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it('counts events by time window', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([{ cnt: 5 }]))   // last24h
      .mockReturnValueOnce(chain([{ cnt: 20 }]))  // last7d
      .mockReturnValueOnce(chain([{ cnt: 60 }]))  // last30d
      .mockReturnValueOnce(chain([]))             // bySeverity
      .mockReturnValueOnce(chain([]));            // topTypes
    const { getSecurityEventKPIs } = await import('../admin-trust-security');
    const kpis = await getSecurityEventKPIs();
    expect(kpis.last24h).toBe(5);
    expect(kpis.last7d).toBe(20);
    expect(kpis.last30d).toBe(60);
  });

  it('returns top event types', async () => {
    mockDbSelect
      .mockReturnValueOnce(chain([{ cnt: 10 }]))
      .mockReturnValueOnce(chain([{ cnt: 35 }]))
      .mockReturnValueOnce(chain([{ cnt: 100 }]))
      .mockReturnValueOnce(chain([{ severity: 'HIGH', cnt: 40 }, { severity: 'CRITICAL', cnt: 5 }]))
      .mockReturnValueOnce(chain([{ action: 'security.login.failed', cnt: 80 }, { action: 'security.fraud.flagged', cnt: 20 }]));
    const { getSecurityEventKPIs } = await import('../admin-trust-security');
    const kpis = await getSecurityEventKPIs();
    expect(kpis.topEventTypes).toHaveLength(2);
    expect(kpis.topEventTypes[0]?.action).toBe('security.login.failed');
    expect(kpis.bySeverity).toHaveLength(2);
  });
});
