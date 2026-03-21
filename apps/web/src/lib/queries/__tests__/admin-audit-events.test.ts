/**
 * Admin Audit Events Query Tests (I11)
 * Covers getHighSeverityAuditEvents and getAuditEventsForSubject.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHighSeverityAuditEvents,
  getAuditEventsForSubject,
} from '../admin-audit-events';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: {
    id: 'id', actorType: 'actor_type', actorId: 'actor_id',
    action: 'action', subject: 'subject', subjectId: 'subject_id',
    severity: 'severity', detailsJson: 'details_json',
    ipAddress: 'ip_address', userAgent: 'user_agent', createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((_col: unknown) => ({ type: 'desc' })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ type: 'inArray' })),
  gte: vi.fn((_col: unknown, _val: unknown) => ({ type: 'gte' })),
  lte: vi.fn((_col: unknown, _val: unknown) => ({ type: 'lte' })),
  sql: vi.fn(() => ({ type: 'sql' })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-15T12:00:00Z');

function makeAuditRow(overrides: Partial<{
  id: string; actorType: string; actorId: string | null;
  action: string; subject: string; subjectId: string | null;
  severity: string; detailsJson: unknown; ipAddress: string | null;
  userAgent: string | null; createdAt: Date;
}> = {}) {
  return {
    id: 'ae-001',
    actorType: 'STAFF',
    actorId: 'staff-001',
    action: 'admin.flag.toggle',
    subject: 'FeatureFlag',
    subjectId: 'flag-001',
    severity: 'HIGH',
    detailsJson: { key: 'kill.checkout' },
    ipAddress: null,
    userAgent: null,
    createdAt: NOW,
    ...overrides,
  };
}

// ─── getHighSeverityAuditEvents ───────────────────────────────────────────────

describe('getHighSeverityAuditEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HIGH and CRITICAL events with total count', async () => {
    const rows = [
      makeAuditRow({ severity: 'HIGH' }),
      makeAuditRow({ id: 'ae-002', severity: 'CRITICAL' }),
    ];
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 2 }]),
    };
    const dataChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue(rows),
    };
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1 ? countChain : dataChain;
    });

    const result = await getHighSeverityAuditEvents({ page: 1, pageSize: 25 });

    expect(result.events).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('maps row fields correctly to AuditEventRow', async () => {
    const row = makeAuditRow({ actorId: null, subjectId: null, ipAddress: null });
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 1 }]),
    };
    const dataChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([row]),
    };
    let call = 0;
    mockDbSelect.mockImplementation(() => { call++; return call === 1 ? countChain : dataChain; });

    const { events } = await getHighSeverityAuditEvents({ page: 1, pageSize: 25 });
    const ev = events[0];

    expect(ev?.id).toBe('ae-001');
    expect(ev?.actorId).toBeNull();
    expect(ev?.subjectId).toBeNull();
    expect(ev?.severity).toBe('HIGH');
  });

  it('returns empty array and zero total when no events', async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    };
    const dataChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    let call = 0;
    mockDbSelect.mockImplementation(() => { call++; return call === 1 ? countChain : dataChain; });

    const result = await getHighSeverityAuditEvents({ page: 1, pageSize: 25 });

    expect(result.events).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('uses pageSize and page for pagination offset', async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 50 }]),
    };
    const offsetMock = vi.fn().mockResolvedValue([]);
    const limitMock = vi.fn().mockReturnValue({ offset: offsetMock });
    const dataChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnValue({ limit: limitMock }),
    };
    let call = 0;
    mockDbSelect.mockImplementation(() => { call++; return call === 1 ? countChain : dataChain; });

    await getHighSeverityAuditEvents({ page: 3, pageSize: 10 });

    expect(offsetMock).toHaveBeenCalledWith(20);
  });

  it('applies subject filter when provided', async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    };
    const dataChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    let call = 0;
    mockDbSelect.mockImplementation(() => { call++; return call === 1 ? countChain : dataChain; });

    const { events } = await getHighSeverityAuditEvents({ subject: 'FeatureFlag', page: 1, pageSize: 25 });

    expect(events).toHaveLength(0);
  });

  it('applies severity filter when provided', async () => {
    const countChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    };
    const dataChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    let call = 0;
    mockDbSelect.mockImplementation(() => { call++; return call === 1 ? countChain : dataChain; });

    await getHighSeverityAuditEvents({ severity: 'CRITICAL', page: 1, pageSize: 25 });

    // Just verify it resolves without error
    expect(mockDbSelect).toHaveBeenCalled();
  });
});

// ─── getAuditEventsForSubject ─────────────────────────────────────────────────

describe('getAuditEventsForSubject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeSubjectChain(rows: unknown[]) {
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
  }

  it('returns events for subject and subjectId', async () => {
    const rows = [
      makeAuditRow({ subject: 'FeatureFlag', subjectId: 'flag-001' }),
      makeAuditRow({ id: 'ae-002', subject: 'FeatureFlag', subjectId: 'flag-001', action: 'admin.flag.delete' }),
    ];
    mockDbSelect.mockReturnValue(makeSubjectChain(rows));

    const result = await getAuditEventsForSubject('FeatureFlag', 'flag-001');

    expect(result).toHaveLength(2);
    expect(result[0]?.subject).toBe('FeatureFlag');
    expect(result[0]?.subjectId).toBe('flag-001');
  });

  it('respects custom limit', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeAuditRow({ id: `ae-${i}` })
    );
    const chain = makeSubjectChain(rows);
    mockDbSelect.mockReturnValue(chain);

    await getAuditEventsForSubject('FeatureFlag', 'flag-001', 5);

    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it('returns empty array when no events found', async () => {
    mockDbSelect.mockReturnValue(makeSubjectChain([]));

    const result = await getAuditEventsForSubject('FeatureFlag', 'nonexistent');

    expect(result).toHaveLength(0);
  });
});
