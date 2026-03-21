/**
 * Tests for finance-center-reports.ts server actions.
 * Covers: generateReportAction, listReportsAction, getReportAction, deleteReportAction
 * Categories: Auth, Validation, CASL, Tier Gate, Happy Path, Delegation, Edge Cases
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockGetPnlReportData = vi.fn();
const mockGetBalanceSheetData = vi.fn();
const mockGetCashFlowData = vi.fn();
const mockGetReportList = vi.fn();
const mockGetReportById = vi.fn();
const mockGeneratePnlCsv = vi.fn();
const mockGenerateBalanceSheetCsv = vi.fn();
const mockGenerateCashFlowCsv = vi.fn();
const mockGeneratePnlHtml = vi.fn();
const mockGenerateBalanceSheetHtml = vi.fn();
const mockGenerateCashFlowHtml = vi.fn();
const mockUploadToR2 = vi.fn();
const mockDeleteFromR2 = vi.fn();
const mockExtractKeyFromUrl = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions,
    __caslSubjectType__: type,
  }),
}));

vi.mock('@/lib/queries/finance-center', () => ({
  getFinanceTier: (...args: unknown[]) => mockGetFinanceTier(...args),
}));

vi.mock('@/lib/queries/finance-center-reports', () => ({
  getPnlReportData: (...args: unknown[]) => mockGetPnlReportData(...args),
  getBalanceSheetData: (...args: unknown[]) => mockGetBalanceSheetData(...args),
  getCashFlowData: (...args: unknown[]) => mockGetCashFlowData(...args),
  getReportList: (...args: unknown[]) => mockGetReportList(...args),
  getReportById: (...args: unknown[]) => mockGetReportById(...args),
}));

vi.mock('@twicely/finance/report-csv', () => ({
  generatePnlCsv: (...args: unknown[]) => mockGeneratePnlCsv(...args),
  generateBalanceSheetCsv: (...args: unknown[]) => mockGenerateBalanceSheetCsv(...args),
  generateCashFlowCsv: (...args: unknown[]) => mockGenerateCashFlowCsv(...args),
}));

vi.mock('@twicely/finance/report-pdf', () => ({
  generatePnlHtml: (...args: unknown[]) => mockGeneratePnlHtml(...args),
  generateBalanceSheetHtml: (...args: unknown[]) => mockGenerateBalanceSheetHtml(...args),
  generateCashFlowHtml: (...args: unknown[]) => mockGenerateCashFlowHtml(...args),
}));

vi.mock('@twicely/storage/r2-client', () => ({
  uploadToR2: (...args: unknown[]) => mockUploadToR2(...args),
  deleteFromR2: (...args: unknown[]) => mockDeleteFromR2(...args),
  extractKeyFromUrl: (...args: unknown[]) => mockExtractKeyFromUrl(...args),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  financialReport: {
    id: 'id',
    userId: 'userId',
    reportType: 'reportType',
    periodStart: 'periodStart',
    periodEnd: 'periodEnd',
    snapshotJson: 'snapshotJson',
    format: 'format',
    fileUrl: 'fileUrl',
    createdAt: 'createdAt',
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const VALID_START = '2026-01-01T00:00:00.000Z';
const VALID_END = '2026-01-31T23:59:59.000Z';
const VALID_REPORT_ID = 'cly1r2s3t4u5v6w7x8y9z0ab1';

const SAVED_REPORT = {
  id: VALID_REPORT_ID,
  reportType: 'PNL',
  periodStart: new Date(VALID_START),
  periodEnd: new Date(VALID_END),
  snapshotJson: { grossRevenueCents: 50000 },
  format: 'JSON',
  fileUrl: null,
  createdAt: new Date('2026-03-04T00:00:00.000Z'),
};

const EMPTY_PNL = {
  periodStart: VALID_START,
  periodEnd: VALID_END,
  generatedAt: '2026-03-04T00:00:00.000Z',
  grossRevenueCents: 0, totalOrderCount: 0, cogsTotalCents: 0, grossProfitCents: 0,
  tfFeesCents: 0, stripeFeesCents: 0, boostFeesCents: 0, insertionFeesCents: 0,
  localFeesCents: 0, authFeesCents: 0, subscriptionChargesCents: 0,
  crosslisterFeesCents: 0, totalPlatformFeesCents: 0, crosslisterRevenueCents: 0,
  shippingCostsCents: 0, netAfterFeesCents: 0, operatingExpensesCents: 0,
  expensesByCategory: [], mileageDeductionCents: 0, totalMiles: 0, tripCount: 0,
  netProfitCents: 0, avgSalePriceCents: 0, effectiveFeeRatePercent: 0, cogsMarginPercent: 0,
};

function makeInsertReturning(row: unknown) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([row]),
    }),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue([]),
  };
}

function mockAuth(overrides?: { delegationId?: string | null; onBehalfOfSellerId?: string }) {
  mockAuthorize.mockResolvedValue({
    session: {
      userId: 'user-test-001',
      delegationId: overrides?.delegationId ?? null,
      onBehalfOfSellerId: overrides?.onBehalfOfSellerId ?? null,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

// ---------------------------------------------------------------------------
// generateReportAction
// ---------------------------------------------------------------------------

describe('generateReportAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns validation error for missing reportType', async () => {
    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      periodStart: VALID_START, periodEnd: VALID_END,
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid reportType enum', async () => {
    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'FAKE_REPORT', periodStart: VALID_START, periodEnd: VALID_END,
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid format enum', async () => {
    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'EXCEL',
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error when periodStart is not before periodEnd', async () => {
    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL',
      periodStart: VALID_END,
      periodEnd: VALID_START, // reversed
      format: 'JSON',
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error for unknown fields (strict schema)', async () => {
    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END,
      format: 'JSON', unknownField: 'boom',
    });

    expect(result.success).toBe(false);
  });

  it('returns Forbidden when CASL denies create on FinancialReport', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('rejects delegated staff session (delegationId !== null)', async () => {
    mockAuth({ delegationId: 'del-abc', onBehalfOfSellerId: 'seller-x' });

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Delegated staff cannot generate reports');
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Upgrade to Finance Pro to generate reports');
  });

  it('generates PNL JSON report and inserts it into DB', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockResolvedValue(EMPTY_PNL);
    mockDbInsert.mockReturnValue(makeInsertReturning(SAVED_REPORT));

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.report.id).toBe(VALID_REPORT_ID);
      expect(result.report.reportType).toBe('PNL');
    }
    expect(mockGetPnlReportData).toHaveBeenCalledWith('user-test-001', expect.any(Date), expect.any(Date));
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/statements');
  });

  it('generates BALANCE_SHEET JSON report calling getBalanceSheetData', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetBalanceSheetData.mockResolvedValue({
      periodStart: VALID_START, periodEnd: VALID_END, generatedAt: '',
      assets: { availableForPayoutCents: 0, pendingCents: 0, inventoryValueCents: 0, inventoryCount: 0, totalCurrentAssetsCents: 0 },
      liabilities: { reservedCents: 0, pendingRefundsCents: 0, totalLiabilitiesCents: 0 },
      equity: { netEquityCents: 0, periodNetProfitCents: 0, totalEquityCents: 0 },
    });
    const bsReport = { ...SAVED_REPORT, reportType: 'BALANCE_SHEET' };
    mockDbInsert.mockReturnValue(makeInsertReturning(bsReport));

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'BALANCE_SHEET', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(true);
    expect(mockGetBalanceSheetData).toHaveBeenCalled();
    expect(mockGetPnlReportData).not.toHaveBeenCalled();
  });

  it('generates CASH_FLOW JSON report calling getCashFlowData', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetCashFlowData.mockResolvedValue({
      periodStart: VALID_START, periodEnd: VALID_END, generatedAt: '',
      operating: { salesReceivedCents: 0, refundsIssuedCents: 0, platformFeesPaidCents: 0, shippingCostsCents: 0, operatingExpensesCents: 0, mileageDeductionCents: 0, netOperatingCents: 0 },
      financing: { payoutsSentCents: 0, payoutsFailedReversedCents: 0, netFinancingCents: 0 },
      netCashChangeCents: 0, beginningBalanceCents: 0, endingBalanceCents: 0,
    });
    const cfReport = { ...SAVED_REPORT, reportType: 'CASH_FLOW' };
    mockDbInsert.mockReturnValue(makeInsertReturning(cfReport));

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'CASH_FLOW', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(true);
    expect(mockGetCashFlowData).toHaveBeenCalled();
  });

  it('generates PNL CSV report: calls generatePnlCsv and uploads to R2', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockResolvedValue(EMPTY_PNL);
    mockGeneratePnlCsv.mockReturnValue('csv,content');
    mockUploadToR2.mockResolvedValue('https://r2.example.com/reports/user-test-001/PNL/rpt.csv');
    const csvReport = { ...SAVED_REPORT, format: 'CSV', fileUrl: 'https://r2.example.com/reports/user-test-001/PNL/rpt.csv' };
    mockDbInsert.mockReturnValue(makeInsertReturning(csvReport));

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'CSV',
    });

    expect(result.success).toBe(true);
    expect(mockGeneratePnlCsv).toHaveBeenCalledWith(EMPTY_PNL);
    expect(mockUploadToR2).toHaveBeenCalledWith(
      expect.stringContaining('reports/user-test-001/PNL/'),
      expect.any(Buffer),
      'text/csv',
    );
  });

  it('generates BALANCE_SHEET CSV report using generateBalanceSheetCsv', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    const bsData = {
      periodStart: VALID_START, periodEnd: VALID_END, generatedAt: '',
      assets: { availableForPayoutCents: 0, pendingCents: 0, inventoryValueCents: 0, inventoryCount: 0, totalCurrentAssetsCents: 0 },
      liabilities: { reservedCents: 0, pendingRefundsCents: 0, totalLiabilitiesCents: 0 },
      equity: { netEquityCents: 0, periodNetProfitCents: 0, totalEquityCents: 0 },
    };
    mockGetBalanceSheetData.mockResolvedValue(bsData);
    mockGenerateBalanceSheetCsv.mockReturnValue('bs,csv');
    mockUploadToR2.mockResolvedValue('https://r2.example.com/bs.csv');
    mockDbInsert.mockReturnValue(makeInsertReturning({ ...SAVED_REPORT, reportType: 'BALANCE_SHEET', format: 'CSV' }));

    const { generateReportAction } = await import('../finance-center-reports');
    await generateReportAction({
      reportType: 'BALANCE_SHEET', periodStart: VALID_START, periodEnd: VALID_END, format: 'CSV',
    });

    expect(mockGenerateBalanceSheetCsv).toHaveBeenCalledWith(bsData);
  });

  it('generates PNL PDF report: calls generatePnlHtml and uploads to R2', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockResolvedValue(EMPTY_PNL);
    mockGeneratePnlHtml.mockReturnValue('<html>pdf</html>');
    mockUploadToR2.mockResolvedValue('https://r2.example.com/reports/user-test-001/PNL/rpt.html');
    const pdfReport = { ...SAVED_REPORT, format: 'PDF', fileUrl: 'https://r2.example.com/reports/user-test-001/PNL/rpt.html' };
    mockDbInsert.mockReturnValue(makeInsertReturning(pdfReport));

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'PDF',
    });

    expect(result.success).toBe(true);
    expect(mockGeneratePnlHtml).toHaveBeenCalledWith(EMPTY_PNL);
    expect(mockUploadToR2).toHaveBeenCalledWith(
      expect.stringContaining('reports/user-test-001/PNL/'),
      expect.any(Buffer),
      'text/html',
    );
  });

  it('CASH_FLOW PDF uses generateCashFlowHtml', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    const cfData = {
      periodStart: VALID_START, periodEnd: VALID_END, generatedAt: '',
      operating: { salesReceivedCents: 0, refundsIssuedCents: 0, platformFeesPaidCents: 0, shippingCostsCents: 0, operatingExpensesCents: 0, mileageDeductionCents: 0, netOperatingCents: 0 },
      financing: { payoutsSentCents: 0, payoutsFailedReversedCents: 0, netFinancingCents: 0 },
      netCashChangeCents: 0, beginningBalanceCents: 0, endingBalanceCents: 0,
    };
    mockGetCashFlowData.mockResolvedValue(cfData);
    mockGenerateCashFlowHtml.mockReturnValue('<html>cf</html>');
    mockUploadToR2.mockResolvedValue('https://r2.example.com/cf.html');
    mockDbInsert.mockReturnValue(makeInsertReturning({ ...SAVED_REPORT, reportType: 'CASH_FLOW', format: 'PDF' }));

    const { generateReportAction } = await import('../finance-center-reports');
    await generateReportAction({
      reportType: 'CASH_FLOW', periodStart: VALID_START, periodEnd: VALID_END, format: 'PDF',
    });

    expect(mockGenerateCashFlowHtml).toHaveBeenCalledWith(cfData);
  });

  it('returns error when DB insert returns empty result', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockResolvedValue(EMPTY_PNL);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to save report');
  });

  it('returns error when getPnlReportData throws', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockRejectedValue(new Error('DB error'));

    const { generateReportAction } = await import('../finance-center-reports');
    const result = await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'JSON',
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to generate report');
  });

  it('CSV key path includes userId, reportType, and .csv extension', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockResolvedValue(EMPTY_PNL);
    mockGeneratePnlCsv.mockReturnValue('csv');
    mockUploadToR2.mockResolvedValue('https://r2.example.com/key.csv');
    mockDbInsert.mockReturnValue(makeInsertReturning(SAVED_REPORT));

    const { generateReportAction } = await import('../finance-center-reports');
    await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'CSV',
    });

    const callArgs = mockUploadToR2.mock.calls[0]!;
    expect(callArgs[0]).toMatch(/^reports\/user-test-001\/PNL\/.+\.csv$/);
  });

  it('PDF key path has .html extension', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetPnlReportData.mockResolvedValue(EMPTY_PNL);
    mockGeneratePnlHtml.mockReturnValue('<html></html>');
    mockUploadToR2.mockResolvedValue('https://r2.example.com/key.html');
    mockDbInsert.mockReturnValue(makeInsertReturning(SAVED_REPORT));

    const { generateReportAction } = await import('../finance-center-reports');
    await generateReportAction({
      reportType: 'PNL', periodStart: VALID_START, periodEnd: VALID_END, format: 'PDF',
    });

    const callArgs = mockUploadToR2.mock.calls[0]!;
    expect(callArgs[0]).toMatch(/\.html$/);
  });
});

// ---------------------------------------------------------------------------
// listReportsAction
// ---------------------------------------------------------------------------

describe('listReportsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const EMPTY_RESULT = { reports: [], total: 0, page: 1, pageSize: 10 };

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 10 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns validation error for non-positive page', async () => {
    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 0, pageSize: 10 });

    expect(result.success).toBe(false);
  });

  it('returns validation error for pageSize exceeding 50', async () => {
    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 51 });

    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid reportType filter', async () => {
    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 10, reportType: 'INVALID' });

    expect(result.success).toBe(false);
  });

  it('returns validation error for unknown fields (strict schema)', async () => {
    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 10, extraField: 'boom' });

    expect(result.success).toBe(false);
  });

  it('returns Forbidden when CASL denies read on FinancialReport', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 10 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns paginated list for authenticated user', async () => {
    mockAuth();
    mockGetReportList.mockResolvedValue({
      reports: [SAVED_REPORT],
      total: 1, page: 1, pageSize: 10,
    });

    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 10 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
      expect(result.data.reports).toHaveLength(1);
    }
  });

  it('passes reportType filter to getReportList', async () => {
    mockAuth();
    mockGetReportList.mockResolvedValue(EMPTY_RESULT);

    const { listReportsAction } = await import('../finance-center-reports');
    await listReportsAction({ page: 1, pageSize: 10, reportType: 'PNL' });

    expect(mockGetReportList).toHaveBeenCalledWith(
      'user-test-001',
      expect.objectContaining({ reportType: 'PNL' }),
    );
  });

  it('uses onBehalfOfSellerId for delegated sessions', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'staff-001', delegationId: 'del-abc', onBehalfOfSellerId: 'seller-target-001' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetReportList.mockResolvedValue(EMPTY_RESULT);

    const { listReportsAction } = await import('../finance-center-reports');
    await listReportsAction({ page: 1, pageSize: 10 });

    expect(mockGetReportList).toHaveBeenCalledWith('seller-target-001', expect.any(Object));
  });

  it('returns error when getReportList throws', async () => {
    mockAuth();
    mockGetReportList.mockRejectedValue(new Error('DB down'));

    const { listReportsAction } = await import('../finance-center-reports');
    const result = await listReportsAction({ page: 1, pageSize: 10 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to load reports');
  });
});

// ---------------------------------------------------------------------------
// getReportAction
// ---------------------------------------------------------------------------

describe('getReportAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when reportId is empty string', async () => {
    const { getReportAction } = await import('../finance-center-reports');
    const result = await getReportAction({ id: '' });

    expect(result.success).toBe(false);
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { getReportAction } = await import('../finance-center-reports');
    const result = await getReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Forbidden when CASL denies read on FinancialReport', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { getReportAction } = await import('../finance-center-reports');
    const result = await getReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns Not found when getReportById returns null', async () => {
    mockAuth();
    mockGetReportById.mockResolvedValue(null);

    const { getReportAction } = await import('../finance-center-reports');
    const result = await getReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Not found');
  });

  it('returns report for authenticated user with correct ID', async () => {
    mockAuth();
    mockGetReportById.mockResolvedValue(SAVED_REPORT);

    const { getReportAction } = await import('../finance-center-reports');
    const result = await getReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.report.id).toBe(VALID_REPORT_ID);
      expect(result.report.snapshotJson).toEqual({ grossRevenueCents: 50000 });
    }
    expect(mockGetReportById).toHaveBeenCalledWith('user-test-001', VALID_REPORT_ID);
  });

  it('uses onBehalfOfSellerId for delegated sessions', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'staff-001', delegationId: 'del-abc', onBehalfOfSellerId: 'seller-target-001' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetReportById.mockResolvedValue(SAVED_REPORT);

    const { getReportAction } = await import('../finance-center-reports');
    await getReportAction({ id: VALID_REPORT_ID });

    expect(mockGetReportById).toHaveBeenCalledWith('seller-target-001', VALID_REPORT_ID);
  });

  it('returns error when getReportById throws', async () => {
    mockAuth();
    mockGetReportById.mockRejectedValue(new Error('DB error'));

    const { getReportAction } = await import('../finance-center-reports');
    const result = await getReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to load report');
  });
});

// ---------------------------------------------------------------------------
// deleteReportAction
// ---------------------------------------------------------------------------

describe('deleteReportAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns validation error for missing id', async () => {
    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({});

    expect(result.success).toBe(false);
  });

  it('returns validation error for empty id string', async () => {
    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: '' });

    expect(result.success).toBe(false);
  });

  it('returns validation error for unknown fields (strict schema)', async () => {
    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: 'rpt-test-001', extra: 'field' });

    expect(result.success).toBe(false);
  });

  it('rejects delegated staff session (delegationId !== null)', async () => {
    mockAuth({ delegationId: 'del-abc', onBehalfOfSellerId: 'seller-x' });

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Delegated staff cannot delete reports');
  });

  it('returns Forbidden when CASL denies delete on FinancialReport', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns Not found when report does not exist', async () => {
    mockAuth();
    mockGetReportById.mockResolvedValue(null);

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Not found');
  });

  it('deletes report without file and revalidates path', async () => {
    mockAuth();
    mockGetReportById.mockResolvedValue({ ...SAVED_REPORT, fileUrl: null });
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(true);
    expect(mockDeleteFromR2).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/statements');
  });

  it('deletes R2 file when fileUrl is present', async () => {
    mockAuth();
    const fileUrl = 'https://r2.example.com/reports/user-test-001/PNL/rpt-test-001.csv';
    mockGetReportById.mockResolvedValue({ ...SAVED_REPORT, fileUrl });
    mockExtractKeyFromUrl.mockReturnValue('reports/user-test-001/PNL/rpt-test-001.csv');
    mockDeleteFromR2.mockResolvedValue(undefined);
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(true);
    expect(mockExtractKeyFromUrl).toHaveBeenCalledWith(fileUrl);
    expect(mockDeleteFromR2).toHaveBeenCalledWith('reports/user-test-001/PNL/rpt-test-001.csv');
  });

  it('skips R2 delete when extractKeyFromUrl returns null (no key)', async () => {
    mockAuth();
    mockGetReportById.mockResolvedValue({ ...SAVED_REPORT, fileUrl: 'https://some.url/file' });
    mockExtractKeyFromUrl.mockReturnValue(null);
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(true);
    expect(mockDeleteFromR2).not.toHaveBeenCalled();
  });

  it('returns error when delete throws', async () => {
    mockAuth();
    mockGetReportById.mockResolvedValue({ ...SAVED_REPORT, fileUrl: null });
    mockDbDelete.mockReturnValue({ where: vi.fn().mockRejectedValue(new Error('DB down')) });

    const { deleteReportAction } = await import('../finance-center-reports');
    const result = await deleteReportAction({ id: VALID_REPORT_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to delete report');
  });
});
