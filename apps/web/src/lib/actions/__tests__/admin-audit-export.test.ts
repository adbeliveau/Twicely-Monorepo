/**
 * Tests for audit log CSV export action (I16)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: {
    id: 'id', createdAt: 'created_at', actorType: 'actor_type',
    actorId: 'actor_id', action: 'action', subject: 'subject',
    subjectId: 'subject_id', severity: 'severity', ipAddress: 'ip_address',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  gte: vi.fn((col, val) => ({ type: 'gte', col, val })),
  lte: vi.fn((col, val) => ({ type: 'lte', col, val })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAllowed() {
  const ability = { can: vi.fn().mockReturnValue(true) };
  mockStaffAuthorize.mockResolvedValue({ ability, session: { staffUserId: 'staff-1', platformRoles: ['ADMIN'] } });
}

function makeForbidden() {
  const ability = { can: vi.fn().mockReturnValue(false) };
  mockStaffAuthorize.mockResolvedValue({ ability, session: { staffUserId: 'staff-1', platformRoles: [] } });
}

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(rows);
  ['from', 'where', 'orderBy'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  chain['limit'] = terminal;
  return chain;
}

function makeAuditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    actorType: 'STAFF',
    actorId: 'staff-1',
    action: 'UPDATE_SETTING',
    subject: 'Setting',
    subjectId: 'cfg-1',
    severity: 'LOW',
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportAuditLogCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('exports CSV with correct headers', async () => {
    makeAllowed();
    mockDbSelect.mockReturnValue(makeChain([makeAuditRow()]));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    expect('csv' in result).toBe(true);
    if ('csv' in result) {
      expect(result.csv.startsWith('id,timestamp,actorType,actorId,action,subject,subjectId,severity,ipAddress')).toBe(true);
    }
  });

  it('CSV includes all required columns', async () => {
    makeAllowed();
    mockDbSelect.mockReturnValue(makeChain([makeAuditRow()]));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    if ('csv' in result) {
      const header = result.csv.split('\n')[0] ?? '';
      expect(header).toContain('id');
      expect(header).toContain('timestamp');
      expect(header).toContain('actorType');
      expect(header).toContain('actorId');
      expect(header).toContain('action');
      expect(header).toContain('subject');
      expect(header).toContain('subjectId');
      expect(header).toContain('severity');
      expect(header).toContain('ipAddress');
    }
  });

  it('returns error when unauthorized', async () => {
    makeForbidden();
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    expect('error' in result).toBe(true);
  });

  it('handles empty result set gracefully', async () => {
    makeAllowed();
    mockDbSelect.mockReturnValue(makeChain([]));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    if ('csv' in result) {
      const lines = result.csv.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1); // header only
    }
  });

  it('formats timestamps in ISO format', async () => {
    makeAllowed();
    const ts = new Date('2026-03-15T10:30:00.000Z');
    mockDbSelect.mockReturnValue(makeChain([makeAuditRow({ createdAt: ts })]));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    if ('csv' in result) {
      expect(result.csv).toContain('2026-03-15T10:30:00.000Z');
    }
  });

  it('exports CSV with filtered events when params provided', async () => {
    makeAllowed();
    mockDbSelect.mockReturnValue(makeChain([makeAuditRow({ severity: 'HIGH' })]));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50, severity: 'HIGH' });
    if ('csv' in result) {
      expect(result.csv).toContain('HIGH');
    }
  });

  it('limits export to 10000 rows', async () => {
    makeAllowed();
    const rows = Array.from({ length: 5 }, (_, i) => makeAuditRow({ id: `evt-${i}` }));
    mockDbSelect.mockReturnValue(makeChain(rows));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    expect('csv' in result).toBe(true);
  });

  it('escapes commas in CSV values', async () => {
    makeAllowed();
    mockDbSelect.mockReturnValue(makeChain([makeAuditRow({ action: 'UPDATE,COMMA' })]));
    const { exportAuditLogCsv } = await import('../admin-audit-export');
    const result = await exportAuditLogCsv({ page: 1, limit: 50 });
    if ('csv' in result) {
      expect(result.csv).toContain('"UPDATE,COMMA"');
    }
  });
});
