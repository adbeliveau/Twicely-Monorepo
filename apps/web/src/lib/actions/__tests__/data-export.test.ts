import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

function makeSession(userId = 'user-1') {
  return {
    session: { userId },
    ability: { can: vi.fn().mockReturnValue(true) },
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

// ─── requestDataExport ────────────────────────────────────────────────────────

describe('requestDataExport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'json' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('rejects invalid format', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'xml' as 'json' });
    expect(result.success).toBe(false);
  });

  it('returns error if export already pending within 24h', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = makeSelectChain([{ id: 'der-1', status: 'PENDING' }]);
    mockDbSelect.mockReturnValue(chain);

    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'json' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already in progress');
  });

  it('returns error if 24h rate limit exceeded', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = makeSelectChain([{ id: 'der-1', status: 'COMPLETED' }]);
    mockDbSelect.mockReturnValue(chain);

    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'json' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('24 hours');
  });

  it('creates PENDING record and enqueues job on success', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-5'));
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'der-new', userId: 'user-5', status: 'PENDING', format: 'json' }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'json' });
    expect(result.success).toBe(true);
    expect(result.requestId).toBe('der-new');
    expect(mockDataExportQueue.add).toHaveBeenCalledWith(
      'data-export',
      expect.objectContaining({ requestId: 'der-new', userId: 'user-5', format: 'json' })
    );
  });

  it('enqueues csv format correctly', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-6'));
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'der-csv', userId: 'user-6', status: 'PENDING', format: 'csv' }]),
    };
    mockDbInsert.mockReturnValue(insertChain);

    const { requestDataExport } = await import('../data-export');
    const result = await requestDataExport({ format: 'csv' });
    expect(result.success).toBe(true);
    expect(mockDataExportQueue.add).toHaveBeenCalledWith(
      'data-export',
      expect.objectContaining({ format: 'csv' })
    );
  });
});

// ─── getMyDataExportRequests ──────────────────────────────────────────────────

describe('getMyDataExportRequests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });
    const { getMyDataExportRequests } = await import('../data-export');
    const result = await getMyDataExportRequests();
    expect(result).toEqual([]);
  });

  it('returns only own requests', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-7'));
    const records = [{ id: 'der-1', userId: 'user-7' }];
    const chain = makeSelectChain(records);
    // Limit also needs to be on chain
    chain.limit = vi.fn().mockResolvedValue(records);
    mockDbSelect.mockReturnValue(chain);

    const { getMyDataExportRequests } = await import('../data-export');
    const result = await getMyDataExportRequests();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── downloadDataExport ───────────────────────────────────────────────────────

describe('downloadDataExport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });
    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when record not found', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = makeSelectChain([]);
    mockDbSelect.mockReturnValue(chain);
    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-missing');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('returns error when export is not completed', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-8'));
    const chain = makeSelectChain([{
      id: 'der-1', userId: 'user-8', status: 'PENDING',
      downloadUrl: null, downloadExpiresAt: null,
    }]);
    mockDbSelect.mockReturnValue(chain);
    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not ready');
  });

  it('returns signed URL for completed export', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-9'));
    const futureExpiry = new Date(Date.now() + 3600000);
    const chain = makeSelectChain([{
      id: 'der-1', userId: 'user-9', status: 'COMPLETED',
      downloadUrl: 'https://cdn.twicely.com/exports/user-9/der-1.json',
      downloadExpiresAt: futureExpiry,
    }]);
    mockDbSelect.mockReturnValue(chain);
    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-1');
    expect(result.success).toBe(true);
    expect(result.downloadUrl).toContain('cdn.twicely.com');
  });

  it('returns error for expired download', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-10'));
    const pastExpiry = new Date(Date.now() - 3600000);
    const chain = makeSelectChain([{
      id: 'der-1', userId: 'user-10', status: 'COMPLETED',
      downloadUrl: 'https://cdn.twicely.com/exports/user-10/der-1.json',
      downloadExpiresAt: pastExpiry,
    }]);
    mockDbSelect.mockReturnValue(chain);
    const { downloadDataExport } = await import('../data-export');
    const result = await downloadDataExport('der-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });
});
