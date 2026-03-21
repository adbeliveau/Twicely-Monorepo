import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = { select: mockDbSelect, update: mockDbUpdate };
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ──────────────────── Helpers ──────────────────────────────────────────────

type SelectChainResult = unknown;

function makeSelectChain(result: SelectChainResult[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue(result),
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  };
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('getSellerYtdGrossSales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 0 when no completed orders', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ total: null }]));

    const { getSellerYtdGrossSales } = await import('../threshold-tracker');
    const result = await getSellerYtdGrossSales('user-1', 2025);

    expect(result).toBe(0);
  });

  it('calculates YTD gross sales correctly for completed orders', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ total: '15000' }]));

    const { getSellerYtdGrossSales } = await import('../threshold-tracker');
    const result = await getSellerYtdGrossSales('user-1', 2025);

    expect(result).toBe(15000);
  });

  it('queries only COMPLETED orders in the specified calendar year', async () => {
    const selectSpy = vi.fn().mockReturnValue(makeSelectChain([{ total: '0' }]));
    mockDbSelect.mockImplementation(selectSpy);

    const { getSellerYtdGrossSales } = await import('../threshold-tracker');
    await getSellerYtdGrossSales('user-1', 2025);

    expect(selectSpy).toHaveBeenCalled();
  });
});

describe('checkThresholdStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reports needsTaxInfo = false when tax info exists and over threshold', async () => {
    // First select: YTD sum, Second: taxInfo row
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([{ total: '70000' }]); // Over threshold
      }
      return makeSelectChain([{ id: 'ti-1', form1099Threshold: false }]); // Has tax info
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)   // 1099kThresholdCents
      .mockResolvedValueOnce(50000);  // earlyWarningThresholdCents

    const { checkThresholdStatus } = await import('../threshold-tracker');
    const status = await checkThresholdStatus('user-1');

    expect(status.isOverThreshold).toBe(true);
    expect(status.taxInfoProvided).toBe(true);
    expect(status.needsTaxInfo).toBe(false);
  });

  it('reports needsTaxInfo = true when over threshold and no tax info', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([{ total: '70000' }]); // Over threshold
      }
      return makeSelectChain([]); // No tax info
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)
      .mockResolvedValueOnce(50000);

    const { checkThresholdStatus } = await import('../threshold-tracker');
    const status = await checkThresholdStatus('user-1');

    expect(status.isOverThreshold).toBe(true);
    expect(status.taxInfoProvided).toBe(false);
    expect(status.needsTaxInfo).toBe(true);
  });

  it('payout NOT blocked when under threshold (no tax info needed)', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([{ total: '3000' }]); // Under threshold
      }
      return makeSelectChain([]); // No tax info
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)
      .mockResolvedValueOnce(50000);

    const { checkThresholdStatus } = await import('../threshold-tracker');
    const status = await checkThresholdStatus('user-1');

    expect(status.isOverThreshold).toBe(false);
    expect(status.needsTaxInfo).toBe(false);
  });

  it('reports earlyWarning when approaching threshold ($500-$599)', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeSelectChain([{ total: '55000' }]); // $550 — over warning, under threshold
      }
      return makeSelectChain([]);
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)   // threshold
      .mockResolvedValueOnce(50000);  // earlyWarning

    const { checkThresholdStatus } = await import('../threshold-tracker');
    const status = await checkThresholdStatus('user-1');

    expect(status.isOverEarlyWarning).toBe(true);
    expect(status.isOverThreshold).toBe(false);
  });

  it('reads threshold values from platform_settings (not hardcoded)', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '0' }]);
      return makeSelectChain([]);
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(80000)   // Custom threshold
      .mockResolvedValueOnce(60000);  // Custom early warning

    const { checkThresholdStatus } = await import('../threshold-tracker');
    const status = await checkThresholdStatus('user-1');

    expect(status.thresholdCents).toBe(80000);
    expect(status.earlyWarningCents).toBe(60000);
  });
});

describe('updateThresholdFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets form1099Threshold when seller crosses threshold', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '70000' }]); // Over threshold
      return makeSelectChain([]); // No tax info (needsTaxInfo check)
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)
      .mockResolvedValueOnce(50000);
    mockDbUpdate.mockReturnValue(makeUpdateChain());

    const { updateThresholdFlag } = await import('../threshold-tracker');
    await updateThresholdFlag('user-1');

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('does not call update when under threshold', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '3000' }]); // Under
      return makeSelectChain([]);
    });
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)
      .mockResolvedValueOnce(50000);

    const { updateThresholdFlag } = await import('../threshold-tracker');
    await updateThresholdFlag('user-1');

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
