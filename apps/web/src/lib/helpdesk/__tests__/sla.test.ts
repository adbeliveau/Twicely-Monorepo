import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockDb = { select: mockSelect };
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/queries/platform-settings', () => ({ getPlatformSetting: mockGetPlatformSetting }));

function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from', 'where', 'limit'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('calculateSlaDue', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  const NOW = new Date('2026-03-15T10:00:00Z');

  it('returns fallback when no SLA policy found for priority', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]));

    const { calculateSlaDue } = await import('../sla');
    const result = await calculateSlaDue('NORMAL', NOW);
    // Fallback: 8h first response, 48h resolution
    expect(result.firstResponseDue.getTime()).toBe(NOW.getTime() + 8 * 60 * 60 * 1000);
    expect(result.resolutionDue.getTime()).toBe(NOW.getTime() + 48 * 60 * 60 * 1000);
  });

  it('calculates calendar-based SLA when businessHoursOnly is false', async () => {
    const policy = {
      priority: 'NORMAL',
      firstResponseMinutes: 480, // 8 hours
      resolutionMinutes: 2880, // 48 hours
      businessHoursOnly: false,
      escalateOnBreach: false,
    };
    mockSelect.mockReturnValue(makeSelectChain([policy]));

    const { calculateSlaDue } = await import('../sla');
    const result = await calculateSlaDue('NORMAL', NOW);
    expect(result.firstResponseDue.getTime()).toBe(NOW.getTime() + 480 * 60 * 1000);
    expect(result.resolutionDue.getTime()).toBe(NOW.getTime() + 2880 * 60 * 1000);
  });

  it('calculates CRITICAL priority with shorter SLA window', async () => {
    const policy = {
      priority: 'CRITICAL',
      firstResponseMinutes: 30, // 30 minutes
      resolutionMinutes: 240, // 4 hours
      businessHoursOnly: false,
      escalateOnBreach: true,
    };
    mockSelect.mockReturnValue(makeSelectChain([policy]));

    const { calculateSlaDue } = await import('../sla');
    const result = await calculateSlaDue('CRITICAL', NOW);
    expect(result.firstResponseDue.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000);
    expect(result.resolutionDue.getTime()).toBe(NOW.getTime() + 240 * 60 * 1000);
  });

  it('uses business hours when businessHoursOnly is true', async () => {
    const policy = {
      priority: 'HIGH',
      firstResponseMinutes: 120,
      resolutionMinutes: 480,
      businessHoursOnly: true,
      escalateOnBreach: false,
    };
    mockSelect.mockReturnValue(makeSelectChain([policy]));
    mockGetPlatformSetting
      .mockResolvedValueOnce('09:00') // start
      .mockResolvedValueOnce('18:00') // end
      .mockResolvedValueOnce('America/New_York') // timezone
      .mockResolvedValueOnce([1, 2, 3, 4, 5]); // work days

    // Use a Monday at 09:00 for predictable results
    const mondayMorning = new Date('2026-03-16T09:00:00.000Z');
    const { calculateSlaDue } = await import('../sla');
    const result = await calculateSlaDue('HIGH', mondayMorning);
    // With business hours, 120 minutes from 09:00 should be 11:00
    expect(result.firstResponseDue.getTime()).toBeGreaterThan(mondayMorning.getTime());
    expect(result.resolutionDue.getTime()).toBeGreaterThan(result.firstResponseDue.getTime());
  });

  it('firstResponseDue is always before resolutionDue', async () => {
    const policy = {
      priority: 'URGENT',
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
      businessHoursOnly: false,
      escalateOnBreach: false,
    };
    mockSelect.mockReturnValue(makeSelectChain([policy]));

    const { calculateSlaDue } = await import('../sla');
    const result = await calculateSlaDue('URGENT', NOW);
    expect(result.firstResponseDue.getTime()).toBeLessThan(result.resolutionDue.getTime());
  });

  it('returns Date objects (not strings)', async () => {
    mockSelect.mockReturnValue(makeSelectChain([])); // fallback path
    const { calculateSlaDue } = await import('../sla');
    const result = await calculateSlaDue('LOW', NOW);
    expect(result.firstResponseDue).toBeInstanceOf(Date);
    expect(result.resolutionDue).toBeInstanceOf(Date);
  });
});
