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

describe('getAffiliatesNeedingTaxInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when no affiliates exceed threshold', async () => {
    mockGetPlatformSetting.mockResolvedValue(60000);
    mockDbSelect.mockImplementation(() =>
      makeChain([{ affiliateId: 'aff-1', total: '30000' }]) // under threshold
    );

    const { getAffiliatesNeedingTaxInfo } = await import('../tax-compliance-affiliates');
    const result = await getAffiliatesNeedingTaxInfo(2025);

    expect(result).toHaveLength(0);
  });

  it('returns affiliates over threshold with masked TIN', async () => {
    mockGetPlatformSetting.mockResolvedValue(60000);

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // commission totals grouped by affiliate
        return makeChain([{ affiliateId: 'aff-1', total: '75000' }]);
      }
      if (callCount === 2) {
        // affiliate row to get userId
        return makeChain([{ userId: 'user-aff-1' }]);
      }
      if (callCount === 3) {
        // user row
        return makeChain([{ id: 'user-aff-1', email: 'aff@example.com' }]);
      }
      if (callCount === 4) {
        // taxInfo row
        return makeChain([{ taxIdLastFour: '9876', taxIdType: 'SSN' }]);
      }
      // doc row
      return makeChain([]);
    });

    const { getAffiliatesNeedingTaxInfo } = await import('../tax-compliance-affiliates');
    const result = await getAffiliatesNeedingTaxInfo(2025);

    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe('aff@example.com');
    expect(result[0]!.maskedTaxId).toBe('***-**-9876');
    expect(result[0]!.ytdGrossCents).toBe(75000);
    expect(result[0]!.taxInfoProvided).toBe(true);
  });

  it('maskedTaxId is null when affiliate has no tax info on file', async () => {
    mockGetPlatformSetting.mockResolvedValue(60000);

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([{ affiliateId: 'aff-2', total: '65000' }]);
      if (callCount === 2) return makeChain([{ userId: 'user-aff-2' }]);
      if (callCount === 3) return makeChain([{ id: 'user-aff-2', email: 'noinfo@example.com' }]);
      if (callCount === 4) return makeChain([]); // no taxInfo
      return makeChain([]);
    });

    const { getAffiliatesNeedingTaxInfo } = await import('../tax-compliance-affiliates');
    const result = await getAffiliatesNeedingTaxInfo(2025);

    expect(result[0]!.maskedTaxId).toBeNull();
    expect(result[0]!.taxInfoProvided).toBe(false);
  });

  it('doc1099KGenerated is true when 1099-NEC report exists', async () => {
    mockGetPlatformSetting.mockResolvedValue(60000);

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([{ affiliateId: 'aff-3', total: '70000' }]);
      if (callCount === 2) return makeChain([{ userId: 'user-aff-3' }]);
      if (callCount === 3) return makeChain([{ id: 'user-aff-3', email: 'doc@example.com' }]);
      if (callCount === 4) return makeChain([{ taxIdLastFour: '1111', taxIdType: 'EIN' }]);
      return makeChain([{ id: 'report-1' }]); // 1099-NEC doc exists
    });

    const { getAffiliatesNeedingTaxInfo } = await import('../tax-compliance-affiliates');
    const result = await getAffiliatesNeedingTaxInfo(2025);

    expect(result[0]!.doc1099KGenerated).toBe(true);
  });

  it('skips affiliate when affiliate record not found in DB', async () => {
    mockGetPlatformSetting.mockResolvedValue(60000);

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeChain([{ affiliateId: 'aff-ghost', total: '80000' }]);
      return makeChain([]); // affiliate record not found
    });

    const { getAffiliatesNeedingTaxInfo } = await import('../tax-compliance-affiliates');
    const result = await getAffiliatesNeedingTaxInfo(2025);

    expect(result).toHaveLength(0);
  });

  it('reads threshold from platform_settings (not hardcoded)', async () => {
    mockGetPlatformSetting.mockResolvedValue(80000); // custom threshold
    mockDbSelect.mockImplementation(() =>
      makeChain([{ affiliateId: 'aff-1', total: '70000' }]) // under custom threshold
    );

    const { getAffiliatesNeedingTaxInfo } = await import('../tax-compliance-affiliates');
    const result = await getAffiliatesNeedingTaxInfo(2025);

    expect(result).toHaveLength(0); // 70000 < 80000
    expect(mockGetPlatformSetting).toHaveBeenCalledWith(
      'tax.1099necThresholdCents',
      expect.any(Number)
    );
  });
});
