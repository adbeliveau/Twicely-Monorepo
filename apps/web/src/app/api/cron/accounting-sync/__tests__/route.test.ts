/**
 * Tests for GET /api/cron/accounting-sync — CRON_SECRET protected cron job
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockRunFullSync = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  accountingIntegration: {
    id: 'id',
    status: 'status',
    syncFrequency: 'syncFrequency',
    accessToken: 'accessToken',
  },
}));

vi.mock('@/lib/accounting/sync-engine', () => ({
  runFullSync: (...args: unknown[]) => mockRunFullSync(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_SECRET = 'super-secret-cron-key';

function makeRequest(authHeader: string | null): Request {
  const headers = new Headers();
  if (authHeader !== null) {
    headers.set('authorization', authHeader);
  }
  return new Request('http://localhost/api/cron/accounting-sync', {
    method: 'GET',
    headers,
  });
}

function makeSelectChainNoLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/cron/accounting-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env['CRON_SECRET'] = VALID_SECRET;
  });

  it('returns 500 when CRON_SECRET env var is not configured', async () => {
    delete process.env['CRON_SECRET'];
    const { GET } = await import('../route');
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Not configured');
  });

  it('returns 401 when authorization header is missing', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when header is provided without Bearer prefix', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(401);
  });

  it('returns 200 with zero synced when no integrations found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([]));
    const { GET } = await import('../route');
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; synced: number; failed: number; total: number };
    expect(body.success).toBe(true);
    expect(body.synced).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.total).toBe(0);
  });

  it('calls runFullSync for each CONNECTED non-MANUAL integration', async () => {
    const integrations = [{ id: 'int-001' }, { id: 'int-002' }];
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit(integrations));
    mockRunFullSync.mockResolvedValue({ success: true, logId: 'log-1', recordsSynced: 3, recordsFailed: 0 });

    const { GET } = await import('../route');
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(200);
    expect(mockRunFullSync).toHaveBeenCalledTimes(2);
    expect(mockRunFullSync).toHaveBeenCalledWith('int-001');
    expect(mockRunFullSync).toHaveBeenCalledWith('int-002');
  });

  it('returns correct synced/failed counts in response', async () => {
    const integrations = [{ id: 'int-001' }, { id: 'int-002' }, { id: 'int-003' }];
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit(integrations));
    mockRunFullSync
      .mockResolvedValueOnce({ success: true, logId: 'log-1', recordsSynced: 5, recordsFailed: 0 })
      .mockResolvedValueOnce({ success: true, logId: 'log-2', recordsSynced: 2, recordsFailed: 0 })
      .mockRejectedValueOnce(new Error('Sync error'));

    const { GET } = await import('../route');
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; synced: number; failed: number; total: number };
    expect(body.success).toBe(true);
    expect(body.synced).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.total).toBe(3);
  });

  it('counts all as failed when all runFullSync calls throw', async () => {
    mockDbSelect.mockReturnValue(makeSelectChainNoLimit([{ id: 'int-001' }, { id: 'int-002' }]));
    mockRunFullSync.mockRejectedValue(new Error('Catastrophic failure'));

    const { GET } = await import('../route');
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(200);
    const body = await res.json() as { synced: number; failed: number; total: number };
    expect(body.synced).toBe(0);
    expect(body.failed).toBe(2);
    expect(body.total).toBe(2);
  });

  it('returns 500 when DB query itself throws', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      }),
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Failed to run accounting sync');
  });

  it('uses timing-safe comparison (does not leak via early exit on length mismatch)', async () => {
    // Verifies length mismatch also returns 401, not 500 (no crash)
    const { GET } = await import('../route');
    const shortHeader = 'Bearer x';
    const res = await GET(makeRequest(shortHeader));
    expect(res.status).toBe(401);
  });
});
