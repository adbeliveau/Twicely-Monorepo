/**
 * Admin Analytics Server Action — Unit Tests (I10)
 * Covers: fetchAnalyticsTimeSeries — validation, auth, data return
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockStaffAuthorize = vi.fn();
const mockGetAnalyticsTimeSeries = vi.fn();

vi.mock('@twicely/casl/staff-authorize', () => ({
  staffAuthorize: (...args: unknown[]) => mockStaffAuthorize(...args),
}));

vi.mock('@twicely/casl/authorize', () => ({
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = 'Forbidden') {
      super(msg);
      this.name = 'ForbiddenError';
    }
  },
}));

vi.mock('@/lib/queries/admin-analytics', () => ({
  getAnalyticsTimeSeries: (...args: unknown[]) => mockGetAnalyticsTimeSeries(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(canReadAnalytics = true) {
  return {
    session: { staffUserId: 'staff-1' },
    ability: {
      can: (action: string, subject: string) => {
        if (action === 'read' && subject === 'Analytics') return canReadAnalytics;
        return false;
      },
    },
  };
}

const sampleSeries = [
  { date: '2026-03-01', value: 50000 },
  { date: '2026-03-02', value: 75000 },
];

// ─── fetchAnalyticsTimeSeries ─────────────────────────────────────────────────

describe('fetchAnalyticsTimeSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns time series data for valid metric and period', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());
    mockGetAnalyticsTimeSeries.mockResolvedValue(sampleSeries);

    const { fetchAnalyticsTimeSeries } = await import('../admin-analytics');
    const result = await fetchAnalyticsTimeSeries('gmv', 30);

    expect(result).toEqual(sampleSeries);
    expect(mockGetAnalyticsTimeSeries).toHaveBeenCalledWith('gmv', 30);
  });

  it('rejects invalid metric values', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { fetchAnalyticsTimeSeries } = await import('../admin-analytics');

    await expect(
      fetchAnalyticsTimeSeries('revenue' as 'gmv', 30)
    ).rejects.toThrow('Invalid metric or periodDays value');
  });

  it('rejects invalid period values (not 7, 30, or 90)', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession());

    const { fetchAnalyticsTimeSeries } = await import('../admin-analytics');

    await expect(
      fetchAnalyticsTimeSeries('gmv', 14)
    ).rejects.toThrow('Invalid metric or periodDays value');

    await expect(
      fetchAnalyticsTimeSeries('orders', 60)
    ).rejects.toThrow('Invalid metric or periodDays value');
  });

  it('throws ForbiddenError when staff not authenticated', async () => {
    mockStaffAuthorize.mockRejectedValue(
      Object.assign(new Error('Staff authentication required'), { name: 'ForbiddenError' })
    );

    const { fetchAnalyticsTimeSeries } = await import('../admin-analytics');

    await expect(
      fetchAnalyticsTimeSeries('gmv', 30)
    ).rejects.toMatchObject({ name: 'ForbiddenError' });

    expect(mockGetAnalyticsTimeSeries).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when ability cannot read Analytics', async () => {
    mockStaffAuthorize.mockResolvedValue(makeSession(false));

    const { fetchAnalyticsTimeSeries } = await import('../admin-analytics');

    await expect(
      fetchAnalyticsTimeSeries('fees', 7)
    ).rejects.toMatchObject({ name: 'ForbiddenError' });

    expect(mockGetAnalyticsTimeSeries).not.toHaveBeenCalled();
  });
});
