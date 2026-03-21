/**
 * Admin Data Retention Export Actions Tests (I13)
 * Covers retryExportAction (stub — returns not-implemented in this phase).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: vi.fn(),
}));

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

  it('returns not-implemented error when authorized', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-1' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as never);
    const { retryExportAction } = await import('../admin-data-retention-exports');
    const result = await retryExportAction('export-abc123');
    expect(result).toEqual({ error: 'Not implemented in this phase' });
  });

  it('returns error shape (not success shape) when authorized', async () => {
    const { staffAuthorize } = await import('@/lib/casl/staff-authorize');
    vi.mocked(staffAuthorize).mockResolvedValue({
      session: { staffUserId: 'staff-1' },
      ability: { can: vi.fn().mockReturnValue(true) },
    } as never);
    const { retryExportAction } = await import('../admin-data-retention-exports');
    const result = await retryExportAction('any-id');
    expect('error' in result).toBe(true);
    expect('success' in result).toBe(false);
  });
});
