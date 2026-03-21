import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('@/lib/encryption', () => ({
  maskTaxId: (lastFour: string, type: string) =>
    type === 'EIN' ? `**-***${lastFour}` : `***-**-${lastFour}`,
}));

// ──────────────────── Helpers ──────────────────────────────────────────────

function makeChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.groupBy.mockResolvedValue(result);
  chain.limit.mockResolvedValue(result);
  return chain;
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('getTaxComplianceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns correct counts from aggregate queries', async () => {
    let callCount = 0;
    mockGetPlatformSetting
      .mockResolvedValueOnce(60000)  // 1099k threshold
      .mockResolvedValueOnce(50000)  // earlyWarning
      .mockResolvedValueOnce(60000); // 1099nec threshold

    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([{ cnt: 5 }]);             // tax info count
      if (callCount === 2) return makeChain([{ cnt: 3 }]);             // docs count
      if (callCount === 3) return makeChain([                          // seller totals
        { sellerId: 'a', total: '70000' },  // over threshold
        { sellerId: 'b', total: '55000' },  // approaching
        { sellerId: 'c', total: '10000' },  // under
      ]);
      return makeChain([]);  // affiliate totals
    });

    const { getTaxComplianceSummary } = await import('../tax-compliance');
    const result = await getTaxComplianceSummary(2025);

    expect(result.year).toBe(2025);
    expect(result.sellersOverThreshold).toBe(1);
    expect(result.sellersApproachingThreshold).toBe(1);
    expect(result.sellersWithTaxInfo).toBe(5);
    expect(result.docs1099KGenerated).toBe(3);
  });

  it('reads threshold from platform_settings not hardcoded', async () => {
    mockGetPlatformSetting
      .mockResolvedValueOnce(80000)  // Custom threshold
      .mockResolvedValueOnce(70000)
      .mockResolvedValueOnce(80000);

    mockDbSelect.mockImplementation(() => makeChain([]));

    const { getTaxComplianceSummary } = await import('../tax-compliance');
    await getTaxComplianceSummary(2025);

    expect(mockGetPlatformSetting).toHaveBeenCalledWith(
      'tax.1099kThresholdCents',
      expect.any(Number)
    );
  });
});

describe('getSellersNeedingTaxInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns sellers over threshold with masked TIN and doc status', async () => {
    mockGetPlatformSetting.mockResolvedValue(60000);

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // seller totals
        return makeChain([{ sellerId: 'user-A', total: '75000' }]);
      }
      if (callCount === 2) {
        // user lookup
        return makeChain([{ id: 'user-A', email: 'seller@example.com' }]);
      }
      if (callCount === 3) {
        // taxInfo lookup
        return makeChain([{ id: 'ti-1', taxIdLastFour: '4321', taxIdType: 'SSN' }]);
      }
      if (callCount === 4) {
        // doc lookup
        return makeChain([{ id: 'doc-1' }]);
      }
      return makeChain([]);
    });

    const { getSellersNeedingTaxInfo } = await import('../tax-compliance');
    const result = await getSellersNeedingTaxInfo(2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe('seller@example.com');
    expect(result[0]!.maskedTaxId).toBe('***-**-4321');
    expect(result[0]!.taxInfoProvided).toBe(true);
    expect(result[0]!.doc1099KGenerated).toBe(true);
  });
});
