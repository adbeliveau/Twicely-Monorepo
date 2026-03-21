/**
 * Tests for finance-center-mileage.ts queries.
 * Covers: getMileageList, getMileageById, getMileagePeriodSummary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };
const mockGetPlatformSetting = getPlatformSetting as Mock;

function createChain(finalResult: unknown) {
  const makeProxy = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const k of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
      p[k] = (..._args: unknown[]) => makeProxy();
    }
    p.then = (resolve: (v: unknown) => void) => resolve(finalResult);
    return p;
  };
  return makeProxy();
}

const NOW = new Date('2026-03-04T00:00:00.000Z');

const MILEAGE_ROW = {
  id: 'mile-test-001',
  description: 'Post office run',
  miles: 12.5,
  ratePerMile: 0.67,
  deductionCents: 838,
  tripDate: NOW,
  createdAt: NOW,
};

// ─── getMileageList ──────────────────────────────────────────────────────────

describe('getMileageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns paginated results with correct shape', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([MILEAGE_ROW]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-001', {
      page: 1,
      pageSize: 20,
      sortBy: 'tripDate',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.id).toBe('mile-test-001');
    expect(result.entries[0]?.miles).toBe(12.5);
    expect(result.entries[0]?.deductionCents).toBe(838);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('returns zero total when no entries exist', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-002', {
      page: 1,
      pageSize: 20,
      sortBy: 'tripDate',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it('handles missing totalRow gracefully (defaults to 0)', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-003', {
      page: 2,
      pageSize: 10,
      sortBy: 'miles',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(0);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('sorts by miles asc', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-004', {
      page: 1,
      pageSize: 20,
      sortBy: 'miles',
      sortOrder: 'asc',
    });

    expect(result.entries).toEqual([]);
  });

  it('sorts by deductionCents desc', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-005', {
      page: 1,
      pageSize: 20,
      sortBy: 'deductionCents',
      sortOrder: 'desc',
    });

    expect(result.entries).toEqual([]);
  });

  it('sorts by createdAt asc', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-006', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });

    expect(result.entries).toEqual([]);
  });

  it('applies date filter when startDate and endDate provided', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([MILEAGE_ROW]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-001', {
      page: 1,
      pageSize: 20,
      sortBy: 'tripDate',
      sortOrder: 'desc',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-03-04T00:00:00.000Z',
    });

    expect(result.total).toBe(1);
    expect(result.entries).toHaveLength(1);
  });

  it('calculates correct offset for page 3 with pageSize 10', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 30 }]))
      .mockReturnValueOnce(createChain([]));

    const { getMileageList } = await import('../finance-center-mileage');
    const result = await getMileageList('user-test-001', {
      page: 3,
      pageSize: 10,
      sortBy: 'tripDate',
      sortOrder: 'desc',
    });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(30);
  });
});

// ─── getMileageById ──────────────────────────────────────────────────────────

describe('getMileageById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the mileage row when found', async () => {
    mockDb.select.mockReturnValueOnce(createChain([MILEAGE_ROW]));

    const { getMileageById } = await import('../finance-center-mileage');
    const result = await getMileageById('user-test-001', 'mile-test-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('mile-test-001');
    expect(result?.miles).toBe(12.5);
    expect(result?.ratePerMile).toBe(0.67);
    expect(result?.deductionCents).toBe(838);
  });

  it('returns null when entry is not found', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getMileageById } = await import('../finance-center-mileage');
    const result = await getMileageById('user-test-001', 'nonexistent-mile');

    expect(result).toBeNull();
  });
});

// ─── getMileagePeriodSummary ─────────────────────────────────────────────────

describe('getMileagePeriodSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns correct summary with IRS rate from platform settings', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ totalMiles: 150, totalDeductionCents: 10050, tripCount: 12 }]),
    );
    mockGetPlatformSetting.mockResolvedValue(0.67);

    const { getMileagePeriodSummary } = await import('../finance-center-mileage');
    const result = await getMileagePeriodSummary('user-test-001', 30);

    expect(result.totalMiles).toBe(150);
    expect(result.totalDeductionCents).toBe(10050);
    expect(result.tripCount).toBe(12);
    expect(result.ratePerMile).toBe(0.67);
  });

  it('returns zeros when no entries exist in the period', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ totalMiles: 0, totalDeductionCents: 0, tripCount: 0 }]),
    );
    mockGetPlatformSetting.mockResolvedValue(0.70);

    const { getMileagePeriodSummary } = await import('../finance-center-mileage');
    const result = await getMileagePeriodSummary('user-test-002', 30);

    expect(result.totalMiles).toBe(0);
    expect(result.totalDeductionCents).toBe(0);
    expect(result.tripCount).toBe(0);
    expect(result.ratePerMile).toBe(0.70);
  });

  it('returns zeros when DB row is missing (empty array guard)', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));
    mockGetPlatformSetting.mockResolvedValue(0.70);

    const { getMileagePeriodSummary } = await import('../finance-center-mileage');
    const result = await getMileagePeriodSummary('user-test-003', 90);

    expect(result.totalMiles).toBe(0);
    expect(result.totalDeductionCents).toBe(0);
    expect(result.tripCount).toBe(0);
  });

  it('uses default rate 0.70 as fallback key', async () => {
    mockDb.select.mockReturnValueOnce(createChain([{ totalMiles: 50, totalDeductionCents: 3500, tripCount: 5 }]));
    mockGetPlatformSetting.mockResolvedValue(0.70);

    const { getMileagePeriodSummary } = await import('../finance-center-mileage');
    await getMileagePeriodSummary('user-test-001', 30);

    expect(mockGetPlatformSetting).toHaveBeenCalledWith('finance.mileageRatePerMile', 0.70);
  });

  it('passes correct days parameter to date filter', async () => {
    mockDb.select.mockReturnValueOnce(createChain([{ totalMiles: 0, totalDeductionCents: 0, tripCount: 0 }]));
    mockGetPlatformSetting.mockResolvedValue(0.67);

    const { getMileagePeriodSummary } = await import('../finance-center-mileage');
    const result = await getMileagePeriodSummary('user-test-001', 7);

    expect(result.tripCount).toBe(0);
  });
});
