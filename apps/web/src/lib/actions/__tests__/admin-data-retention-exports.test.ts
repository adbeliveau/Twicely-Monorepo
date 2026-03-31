/**
 * Admin Data Retention Export Actions Tests (I13)
 * Covers retryExportAction — retry a failed data export.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  dataExportRequest: { id: 'id', status: 'status', updatedAt: 'updated_at' },
  auditEvent: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val })),
}));

vi.mock('@paralleldrive/cuid2', () => ({ createId: vi.fn().mockReturnValue('cuid-001') }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(rows);
  return chain;
}

function makeUpdateChain() {
  return { set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

import { db } from '@twicely/db';

describe('retryExportAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Forbidden when CASL denies manage on DataExport', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-1' },
      ability: { can: vi.fn().mockReturnValue(false) },
    } as never);
    const { retryExportAction } = await import('../admin-data-retention-exports');
    const result = await retryExportAction('export-abc123');
    expect(result).toEqual({ error: 'Forbidden' });
  });

  it('returns error when export record not found', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-1' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as never);
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    const { retryExportAction } = await import('../admin-data-retention-exports');
    const result = await retryExportAction('export-abc123');
    expect(result).toEqual({ error: 'Export request not found' });
  });

  it('retries a FAILED export and returns success', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-1' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as never);
    vi.mocked(db.select).mockReturnValue(makeSelectChain([{ id: 'exp-1', status: 'FAILED' }]) as never);
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
    vi.mocked(db.insert).mockReturnValue(makeInsertChain() as never);
    const { retryExportAction } = await import('../admin-data-retention-exports');
    const result = await retryExportAction('exp-1');
    expect(result).toEqual({ success: true });
  });
});
