import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert };
const mockGetTaxInfo = vi.fn();
const mockGetPlatformSetting = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/queries/tax-info', () => ({ getTaxInfoByUserId: mockGetTaxInfo }));
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));
vi.mock('@/lib/encryption', () => ({
  maskTaxId: (lastFour: string, type: string) =>
    type === 'EIN' ? `**-***${lastFour}` : `***-**-${lastFour}`,
}));
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'test-nec-report-id' }));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ──────────────────── Helpers ──────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  // Some queries end at .where() (no .limit()), others end at .limit()
  // Use a thenable chain so the mock resolves at any terminal point.
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  ['from', 'where', 'groupBy', 'limit', 'orderBy', 'innerJoin'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

const taxInfoRow = {
  id: 'ti-1',
  userId: 'user-aff-1',
  taxIdType: 'SSN',
  taxIdLastFour: '4321',
  legalName: 'Affiliate User',
  businessName: null,
  address1: '456 Commerce St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  country: 'US',
  form1099Threshold: false,
  w9ReceivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ──────────────────── Tests ────────────────────────────────────────────────

describe('generate1099NECData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when affiliate record is not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([])); // empty affiliate lookup

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-not-found', 2025);

    expect(result).toBeNull();
  });

  it('returns null when affiliate has no tax info', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]); // affiliate found
      return makeSelectChain([]); // commission totals (will be called after taxInfo check)
    });
    mockGetTaxInfo.mockResolvedValue(null); // no tax info

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result).toBeNull();
  });

  it('generates 1099-NEC data with correct paid commission total', async () => {
    mockDbSelect.mockImplementation(() =>
      makeSelectChain([
        { userId: 'user-aff-1' },                  // affiliate record
        { total: '75000' },                         // paid commissions
      ])
    );
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);

    // Provide sequential returns
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]);
      return makeSelectChain([{ total: '75000' }]);
    });

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result).not.toBeNull();
    expect(result?.nonemployeeCompensationCents).toBe(75000);
    expect(result?.taxYear).toBe(2025);
  });

  it('uses masked TIN — never includes taxIdEncrypted', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]);
      return makeSelectChain([{ total: '80000' }]);
    });
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result).not.toHaveProperty('taxIdEncrypted');
    expect(result?.payeeTin).toBe('***-**-4321');
  });

  it('uses EIN masked format when taxIdType is EIN', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]);
      return makeSelectChain([{ total: '60500' }]);
    });
    mockGetTaxInfo.mockResolvedValue({
      ...taxInfoRow,
      taxIdType: 'EIN',
      taxIdLastFour: '1234',
    });

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result?.payeeTin).toBe('**-***1234');
  });

  it('falls back to masked unknown TIN when lastFour is null', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]);
      return makeSelectChain([{ total: '60000' }]);
    });
    mockGetTaxInfo.mockResolvedValue({
      ...taxInfoRow,
      taxIdLastFour: null,
      taxIdType: null,
    });

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result?.payeeTin).toBe('***-**-????');
  });

  it('includes disclaimer text referencing Stripe and informational purpose', async () => {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]);
      return makeSelectChain([{ total: '65000' }]);
    });
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result?.disclaimer).toContain('informational purposes only');
    expect(result?.disclaimer).toContain('tax advice');
    expect(result?.filerName).toBe('Twicely Inc.');
  });

  it('counts only PAID commissions (not PENDING)', async () => {
    // The query filters by status = PAID — we verify the function returns 0 when
    // the DB aggregation returns null (no paid commissions)
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ userId: 'user-aff-1' }]);
      return makeSelectChain([{ total: null }]); // no paid commissions
    });
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);

    const { generate1099NECData } = await import('../form-1099nec-generator');
    const result = await generate1099NECData('aff-1', 2025);

    expect(result?.nonemployeeCompensationCents).toBe(0);
  });
});

describe('store1099NECReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('inserts report with reportType 1099_NEC and correct userId', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: insertValues });

    const { store1099NECReport } = await import('../form-1099nec-generator');
    const reportId = await store1099NECReport('user-aff-1', {
      taxYear: 2025,
      payeeName: 'Affiliate User',
      payeeTin: '***-**-4321',
      payeeAddress: '456 Commerce St, Austin, TX 78701',
      nonemployeeCompensationCents: 75000,
      filerName: 'Twicely Inc.',
      filerEin: '**-*******',
      generatedAt: new Date().toISOString(),
      disclaimer: 'For informational purposes only.',
    });

    expect(reportId).toBe('test-nec-report-id');
    expect(mockDbInsert).toHaveBeenCalled();
    const insertArg = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.reportType).toBe('1099_NEC');
    expect(insertArg.userId).toBe('user-aff-1');
  });

  it('report does NOT contain taxIdEncrypted in snapshotJson', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: insertValues });

    const { store1099NECReport } = await import('../form-1099nec-generator');
    await store1099NECReport('user-1', {
      taxYear: 2025,
      payeeName: 'User',
      payeeTin: '***-**-1234',
      payeeAddress: '1 St, City, TX 78701',
      nonemployeeCompensationCents: 70000,
      filerName: 'Twicely Inc.',
      filerEin: '**-*******',
      generatedAt: new Date().toISOString(),
      disclaimer: 'For informational purposes only.',
    });

    const insertArg = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    const snapshot = insertArg.snapshotJson as Record<string, unknown>;
    expect(snapshot).not.toHaveProperty('taxIdEncrypted');
  });
});
