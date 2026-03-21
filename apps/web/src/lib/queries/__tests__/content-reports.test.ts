import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  contentReport: {
    id: 'id',
    reporterUserId: 'reporter_user_id',
    targetType: 'target_type',
    targetId: 'target_id',
    reason: 'reason',
    description: 'description',
    status: 'status',
    reviewedByStaffId: 'reviewed_by_staff_id',
    reviewedAt: 'reviewed_at',
    reviewNotes: 'review_notes',
    enforcementActionId: 'enforcement_action_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  user: { id: 'id', name: 'name' },
}));

import { db } from '@twicely/db';
import {
  getContentReports,
  getContentReportById,
  getContentReportCountByStatus,
  getUserReportHistory,
  getReportsForTarget,
} from '../content-reports';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockDbSelect = vi.mocked(db.select);

function makePaginatedChain(rows: unknown[], countRow: unknown) {
  const countChain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([countRow]),
  };
  countChain.from.mockReturnValue(countChain);

  const listChain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn().mockResolvedValue(rows),
  };
  listChain.from.mockReturnValue(listChain);
  listChain.where.mockReturnValue(listChain);
  listChain.orderBy.mockReturnValue(listChain);
  listChain.limit.mockReturnValue(listChain);

  const userChain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([{ id: 'reporter-001', name: 'Alice' }]),
  };
  userChain.from.mockReturnValue(userChain);

  return { countChain, listChain, userChain };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getContentReports', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns paginated results filtered by status', async () => {
    const mockReport = {
      id: 'report-001',
      reporterUserId: 'reporter-001',
      targetType: 'LISTING',
      targetId: 'lst-001',
      reason: 'COUNTERFEIT',
      status: 'PENDING',
      createdAt: new Date(),
    };

    const { countChain, listChain, userChain } = makePaginatedChain([mockReport], { count: 1 });

    mockDbSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(listChain as never)
      .mockReturnValueOnce(userChain as never);

    const result = await getContentReports('PENDING', 1, 10);

    expect(result.total).toBe(1);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.reporterName).toBe('Alice');
  });

  it('returns all results when status is null', async () => {
    const { countChain, listChain, userChain } = makePaginatedChain([], { count: 0 });

    mockDbSelect
      .mockReturnValueOnce(countChain as never)
      .mockReturnValueOnce(listChain as never)
      .mockReturnValueOnce(userChain as never);

    const result = await getContentReports(null, 1, 10);

    expect(result.total).toBe(0);
    expect(result.reports).toHaveLength(0);
  });
});

describe('getContentReportById', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns full report with reporter details', async () => {
    const mockReport = {
      id: 'report-001',
      reporterUserId: 'reporter-001',
      reporterName: 'Alice',
      targetType: 'LISTING',
      targetId: 'lst-001',
      reason: 'COUNTERFEIT',
      description: 'Fake item',
      status: 'PENDING',
      reviewedByStaffId: null,
      reviewedAt: null,
      reviewNotes: null,
      enforcementActionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const chain = {
      from: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([mockReport]),
    };
    chain.from.mockReturnValue(chain);
    chain.leftJoin.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getContentReportById('report-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('report-001');
  });

  it('returns null for non-existent report', async () => {
    const chain = {
      from: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([]),
    };
    chain.from.mockReturnValue(chain);
    chain.leftJoin.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getContentReportById('non-existent');

    expect(result).toBeNull();
  });
});

describe('getContentReportCountByStatus', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns correct counts per status', async () => {
    const chain = {
      from: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([
        { status: 'PENDING', count: 5 },
        { status: 'CONFIRMED', count: 2 },
        { status: 'DISMISSED', count: 8 },
      ]),
    };
    chain.from.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getContentReportCountByStatus();

    expect(result.PENDING).toBe(5);
    expect(result.CONFIRMED).toBe(2);
    expect(result.DISMISSED).toBe(8);
    expect(result.UNDER_REVIEW).toBe(0);
  });
});

describe('getUserReportHistory', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns all reports made by a specific user', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([
        { id: 'report-001', targetType: 'LISTING', status: 'PENDING', createdAt: new Date() },
      ]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getUserReportHistory('user-001');

    expect(result).toHaveLength(1);
  });
});

describe('getReportsForTarget', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns reports for a specific listing', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([
        { id: 'report-001', reporterUserId: 'reporter-001', reason: 'COUNTERFEIT', status: 'PENDING', createdAt: new Date() },
      ]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);

    mockDbSelect.mockReturnValue(chain as never);

    const result = await getReportsForTarget('LISTING', 'lst-001');

    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe('COUNTERFEIT');
  });
});
