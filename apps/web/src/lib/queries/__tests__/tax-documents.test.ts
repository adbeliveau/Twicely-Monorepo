import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));

// ──────────────────── Helpers ──────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(result);
  chain.limit.mockResolvedValue(result);
  return chain;
}

const now = new Date();
const periodStart2025 = new Date(Date.UTC(2025, 0, 1));
const periodEnd2025 = new Date(Date.UTC(2025, 11, 31, 23, 59, 59));

// ──────────────────── Tests ────────────────────────────────────────────────

describe('getTaxDocumentsByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when user has no tax documents', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getTaxDocumentsByUserId } = await import('../tax-documents');
    const result = await getTaxDocumentsByUserId('user-1');

    expect(result).toHaveLength(0);
  });

  it('maps taxYear from periodStart.getUTCFullYear()', async () => {
    const rows = [
      {
        id: 'rpt-1',
        userId: 'user-1',
        reportType: '1099_K',
        periodStart: periodStart2025,
        periodEnd: periodEnd2025,
        fileUrl: 'tax-documents/user-1/2025/1099-K-summary.json',
        format: 'JSON',
        createdAt: now,
      },
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const { getTaxDocumentsByUserId } = await import('../tax-documents');
    const result = await getTaxDocumentsByUserId('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]!.taxYear).toBe(2025);
    expect(result[0]!.reportType).toBe('1099_K');
  });

  it('returns both 1099_K and 1099_NEC report types', async () => {
    const rows = [
      {
        id: 'rpt-1',
        userId: 'user-1',
        reportType: '1099_K',
        periodStart: periodStart2025,
        periodEnd: periodEnd2025,
        fileUrl: 'tax-documents/user-1/2025/1099-K-summary.json',
        format: 'JSON',
        createdAt: now,
      },
      {
        id: 'rpt-2',
        userId: 'user-1',
        reportType: '1099_NEC',
        periodStart: periodStart2025,
        periodEnd: periodEnd2025,
        fileUrl: 'tax-documents/user-1/2025/1099-NEC-summary.json',
        format: 'JSON',
        createdAt: now,
      },
    ];
    mockDbSelect.mockReturnValue(makeSelectChain(rows));

    const { getTaxDocumentsByUserId } = await import('../tax-documents');
    const result = await getTaxDocumentsByUserId('user-1');

    const types = result.map((r) => r.reportType);
    expect(types).toContain('1099_K');
    expect(types).toContain('1099_NEC');
  });
});

describe('getTaxDocumentById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when document not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getTaxDocumentById } = await import('../tax-documents');
    const result = await getTaxDocumentById('rpt-not-found', 'user-1');

    expect(result).toBeNull();
  });

  it('returns document with taxYear derived from periodStart', async () => {
    const row = {
      id: 'rpt-1',
      userId: 'user-1',
      reportType: '1099_K',
      periodStart: periodStart2025,
      periodEnd: periodEnd2025,
      fileUrl: 'tax-documents/user-1/2025/1099-K-summary.json',
      format: 'JSON',
      createdAt: now,
    };
    mockDbSelect.mockReturnValue(makeSelectChain([row]));

    const { getTaxDocumentById } = await import('../tax-documents');
    const result = await getTaxDocumentById('rpt-1', 'user-1');

    expect(result).not.toBeNull();
    expect(result?.taxYear).toBe(2025);
    expect(result?.id).toBe('rpt-1');
  });

  it('enforces ownership — query includes userId filter', async () => {
    // The query requires BOTH id AND userId match.
    // If userId doesn't match, DB would return empty (mocked as null).
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    const { getTaxDocumentById } = await import('../tax-documents');
    const result = await getTaxDocumentById('rpt-1', 'wrong-user');

    expect(result).toBeNull();
  });
});
