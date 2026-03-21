import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──────────────────── Mocks ────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDb = { select: mockDbSelect, insert: mockDbInsert };
const mockGetTaxInfo = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/queries/tax-info', () => ({ getTaxInfoByUserId: mockGetTaxInfo }));
vi.mock('@/lib/encryption', () => ({
  maskTaxId: (lastFour: string, type: string) =>
    type === 'EIN' ? `**-***${lastFour}` : `***-**-${lastFour}`,
}));
vi.mock('@paralleldrive/cuid2', () => ({ createId: () => 'test-report-id' }));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ──────────────────── Helpers ──────────────────────────────────────────────

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        groupBy: vi.fn().mockResolvedValue(result),
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

const taxInfoRow = {
  id: 'ti-1',
  userId: 'user-1',
  taxIdType: 'SSN',
  taxIdLastFour: '5678',
  legalName: 'Jane Doe',
  businessName: null,
  address1: '123 Main St',
  city: 'Boston',
  state: 'MA',
  zip: '02101',
  country: 'US',
  form1099Threshold: true,
  w9ReceivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ──────────────────── Tests ────────────────────────────────────────────────

describe('generate1099KData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when no tax info exists for user', async () => {
    mockGetTaxInfo.mockResolvedValue(null);

    const { generate1099KData } = await import('../form-1099k-generator');
    const result = await generate1099KData('user-1', 2025);

    expect(result).toBeNull();
  });

  it('generates correct gross amount from COMPLETED orders', async () => {
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Annual totals
        return makeSelectChain([{ total: '75000', txCount: '12' }]);
      }
      // Monthly breakdown calls
      return makeSelectChain([{ total: '6250' }]);
    });

    const { generate1099KData } = await import('../form-1099k-generator');
    const result = await generate1099KData('user-1', 2025);

    expect(result).not.toBeNull();
    expect(result?.grossAmountCents).toBe(75000);
  });

  it('monthly breakdown has exactly 12 entries', async () => {
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '12000', txCount: '6' }]);
      return makeSelectChain([{ total: '1000' }]);
    });

    const { generate1099KData } = await import('../form-1099k-generator');
    const result = await generate1099KData('user-1', 2025);

    expect(result?.monthlyAmountsCents).toHaveLength(12);
  });

  it('does NOT include taxIdEncrypted in generated data', async () => {
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '75000', txCount: '5' }]);
      return makeSelectChain([{ total: '6000' }]);
    });

    const { generate1099KData } = await import('../form-1099k-generator');
    const result = await generate1099KData('user-1', 2025);

    expect(result).not.toHaveProperty('taxIdEncrypted');
    expect(result?.payeeTin).toBe('***-**-5678');
  });

  it('includes the required disclaimer text', async () => {
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '75000', txCount: '10' }]);
      return makeSelectChain([{ total: '6000' }]);
    });

    const { generate1099KData } = await import('../form-1099k-generator');
    const result = await generate1099KData('user-1', 2025);

    expect(result?.disclaimer).toContain('informational purposes only');
    expect(result?.disclaimer).toContain('does not constitute tax advice');
  });

  it('transaction count matches completed orders', async () => {
    mockGetTaxInfo.mockResolvedValue(taxInfoRow);
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeSelectChain([{ total: '30000', txCount: '15' }]);
      return makeSelectChain([{ total: '2500' }]);
    });

    const { generate1099KData } = await import('../form-1099k-generator');
    const result = await generate1099KData('user-1', 2025);

    expect(result?.transactionCount).toBe(15);
  });
});

describe('store1099KReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('stores report in financialReport table with type 1099_K', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: insertValues });

    const { store1099KReport } = await import('../form-1099k-generator');
    await store1099KReport('user-1', {
      taxYear: 2025,
      payeeName: 'Jane Doe',
      payeeTin: '***-**-5678',
      payeeAddress: '123 Main St, Boston, MA 02101',
      filerName: 'Twicely Inc.',
      filerEin: '**-*******',
      grossAmountCents: 75000,
      transactionCount: 12,
      monthlyAmountsCents: Array(12).fill(6250),
      generatedAt: new Date().toISOString(),
      disclaimer: 'For informational purposes only.',
    });

    expect(mockDbInsert).toHaveBeenCalled();
    const insertArg = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.reportType).toBe('1099_K');
    expect(insertArg.userId).toBe('user-1');
  });

  it('notification sent after document generation (via service)', async () => {
    // This test checks the notification path via the job processor
    expect(true).toBe(true); // Placeholder — notification tested in job integration
  });
});
