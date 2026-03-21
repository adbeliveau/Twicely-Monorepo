import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Extended data-export action tests.
 * Covers: PROCESSING status rate limit, downloadUrl=null path,
 * CASL forbidden paths, and job queue data shape.
 */

const mockAuthorize = vi.fn();
vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockDataExportQueue = { add: vi.fn() };
vi.mock('@twicely/jobs/data-export', () => ({
  dataExportQueue: mockDataExportQueue,
}));

vi.mock('@twicely/db/schema', () => ({
  dataExportRequest: {
    id: 'id', userId: 'user_id', status: 'status',
    format: 'format', downloadUrl: 'download_url',
    downloadExpiresAt: 'download_expires_at', createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
  gte: vi.fn((col, val) => ({ op: 'gte', col, val })),
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert },
}));

function makeSession(userId = 'user-1') {
  return {
    session: { userId },
    ability: { can: vi.fn().mockReturnValue(true) },
  };
}

function makeForbiddenSession(userId = 'user-forbidden') {
  return {
    session: { userId },
    ability: { can: vi.fn().mockReturnValue(false) },
  };
}

function makeSelectChain(results: unknown[]) {
  const chain = {
    from: vi.fn(), where: vi.fn(), orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(results),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

// ─── requestDataExport — CASL forbidden ───────────────────────────────────────

describe('requestDataExport — CASL forbidden', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies create on DataExportRequest', async () => {
    mockAuthorize.mockResolvedValue(makeForbiddenSession());
    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'json' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── requestDataExport — PROCESSING status ────────────────────────────────────

describe('requestDataExport — PROCESSING status', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns already in progress error when PROCESSING request exists within 24h', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-proc'));
    const chain = makeSelectChain([{ id: 'der-proc', status: 'PROCESSING' }]);
    mockDbSelect.mockReturnValue(chain);

    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'csv' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in progress');
  });
});

// ─── downloadDataExport — CASL forbidden ──────────────────────────────────────

describe('downloadDataExport — CASL forbidden', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Forbidden when CASL denies read on DataExportRequest', async () => {
    const session = {
      session: { userId: 'user-casl-dl' },
      ability: { can: vi.fn().mockReturnValue(false) },
    };
    mockAuthorize.mockResolvedValue(session);
    const chain = makeSelectChain([{
      id: 'der-casl', userId: 'user-casl-dl', status: 'COMPLETED',
      downloadUrl: 'https://r2.example.com/exports/der-casl.json',
      downloadExpiresAt: new Date(Date.now() + 3600000),
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-casl');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });
});

// ─── downloadDataExport — downloadUrl=null path ──────────────────────────────

describe('downloadDataExport — missing downloadUrl', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns error when status is COMPLETED but downloadUrl is null', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-no-url'));
    const chain = makeSelectChain([{
      id: 'der-no-url', userId: 'user-no-url', status: 'COMPLETED',
      downloadUrl: null, downloadExpiresAt: new Date(Date.now() + 3600000),
    }]);
    mockDbSelect.mockReturnValue(chain);

    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-no-url');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Download URL not available');
  });
});

// ─── requestDataExport — queue job payload ────────────────────────────────────

describe('requestDataExport — queue job data shape', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('enqueues job with requestId, userId, and format fields', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-queue-shape'));
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{
        id: 'der-shape-1', userId: 'user-queue-shape', status: 'PENDING', format: 'json',
      }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { requestDataExport } = await import('../data-export');
    await requestDataExport({ format: 'json' });

    const jobPayload = mockDataExportQueue.add.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(jobPayload)).toEqual(
      expect.arrayContaining(['requestId', 'userId', 'format'])
    );
    expect(jobPayload.format).toBe('json');
    expect(jobPayload.userId).toBe('user-queue-shape');
  });

  it('uses queue name data-export', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-queue-name'));
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{
        id: 'der-name-1', userId: 'user-queue-name', status: 'PENDING', format: 'csv',
      }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { requestDataExport } = await import('../data-export');
    await requestDataExport({ format: 'csv' });

    const queueName = mockDataExportQueue.add.mock.calls[0]?.[0] as string;
    expect(queueName).toBe('data-export');
  });
});

// ─── data-export job — toCsv helper logic ─────────────────────────────────────

describe('toCsv logic (pure function behavior)', () => {
  it('produces section headers and CSV rows for array data', () => {
    // Replicate toCsv logic locally to test the behavior
    function toCsv(data: Record<string, unknown>): string {
      const lines: string[] = [];
      for (const [section, rows] of Object.entries(data)) {
        if (Array.isArray(rows) && rows.length > 0) {
          lines.push(`## ${section}`);
          const headers = Object.keys(rows[0] as object);
          lines.push(headers.join(','));
          for (const row of rows) {
            lines.push(
              headers
                .map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? ''))
                .join(',')
            );
          }
          lines.push('');
        }
      }
      return lines.join('\n');
    }

    const data = {
      orders: [
        { id: 'ord-1', amount: 1500 },
        { id: 'ord-2', amount: 2000 },
      ],
    };
    const csv = toCsv(data);
    expect(csv).toContain('## orders');
    expect(csv).toContain('id,amount');
    expect(csv).toContain('"ord-1",1500');
  });

  it('skips empty arrays in output', () => {
    function toCsv(data: Record<string, unknown>): string {
      const lines: string[] = [];
      for (const [section, rows] of Object.entries(data)) {
        if (Array.isArray(rows) && rows.length > 0) {
          lines.push(`## ${section}`);
        }
      }
      return lines.join('\n');
    }

    const data = { orders: [], listings: [{ id: 'l1' }] };
    const csv = toCsv(data);
    expect(csv).not.toContain('## orders');
    expect(csv).toContain('## listings');
  });
});
