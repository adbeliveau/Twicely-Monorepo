'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { Printer } from 'lucide-react';
import type { SavedReport, PnlReportData, BalanceSheetData, CashFlowData } from '@/lib/queries/finance-center-reports';
import { formatCentsToDollars, formatReportType, formatDateRange } from '@twicely/finance/format';

interface LineItemProps {
  label: string;
  valueCents: number;
  indent?: boolean;
  bold?: boolean;
  negative?: boolean;
}

function LineItem({ label, valueCents, indent, bold, negative }: LineItemProps) {
  const display = negative
    ? `-${formatCentsToDollars(Math.abs(valueCents))}`
    : formatCentsToDollars(valueCents);

  return (
    <div
      className={`flex justify-between items-center py-1 ${indent ? 'pl-4' : ''} ${
        bold ? 'font-semibold' : 'text-sm'
      }`}
    >
      <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={negative && valueCents !== 0 ? 'text-red-600' : bold ? '' : ''}>{display}</span>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function PnlView({ data }: { data: PnlReportData }) {
  return (
    <div className="divide-y">
      <SectionLabel label="Revenue" />
      <LineItem label="Gross revenue" valueCents={data.grossRevenueCents} />
      <div className="flex justify-between py-1 text-sm">
        <span className="text-muted-foreground">Order count</span>
        <span>{data.totalOrderCount}</span>
      </div>

      {data.cogsTotalCents > 0 && (
        <>
          <SectionLabel label="Cost of Goods Sold" />
          <LineItem label="Cost of goods sold" valueCents={data.cogsTotalCents} indent negative />
          <LineItem label="Gross profit" valueCents={data.grossProfitCents} bold />
        </>
      )}

      <SectionLabel label="Platform Fees" />
      <LineItem label="Transaction Fee" valueCents={data.tfFeesCents} indent negative />
      <LineItem label="Payment processing fee" valueCents={data.stripeFeesCents} indent negative />
      {data.boostFeesCents > 0 && <LineItem label="Boost fees" valueCents={data.boostFeesCents} indent negative />}
      {data.insertionFeesCents > 0 && <LineItem label="Insertion fees" valueCents={data.insertionFeesCents} indent negative />}
      {data.localFeesCents > 0 && <LineItem label="Local sale fees" valueCents={data.localFeesCents} indent negative />}
      {data.authFeesCents > 0 && <LineItem label="Authentication fees" valueCents={data.authFeesCents} indent negative />}
      {data.subscriptionChargesCents > 0 && <LineItem label="Subscription charges" valueCents={data.subscriptionChargesCents} indent negative />}
      <LineItem label="Total platform fees" valueCents={data.totalPlatformFeesCents} bold negative />

      {data.shippingCostsCents > 0 && (
        <>
          <SectionLabel label="Shipping" />
          <LineItem label="Shipping costs" valueCents={data.shippingCostsCents} indent negative />
        </>
      )}

      <LineItem label="Net after fees" valueCents={data.netAfterFeesCents} bold />

      {data.operatingExpensesCents > 0 && (
        <>
          <SectionLabel label="Operating Expenses" />
          {data.expensesByCategory.map((cat) => (
            <LineItem key={cat.category} label={cat.category} valueCents={cat.totalCents} indent negative />
          ))}
          <LineItem label="Total operating expenses" valueCents={data.operatingExpensesCents} bold negative />
        </>
      )}

      {data.mileageDeductionCents > 0 && (
        <>
          <SectionLabel label="Mileage Deductions" />
          <LineItem
            label={`${data.tripCount} trips \u2022 ${data.totalMiles.toFixed(1)} miles`}
            valueCents={data.mileageDeductionCents}
            indent
            negative
          />
        </>
      )}

      <div className="pt-2">
        <LineItem label="Net earnings" valueCents={data.netProfitCents} bold />
      </div>

      <SectionLabel label="Key Performance Indicators" />
      <div className="flex justify-between py-1 text-sm">
        <span className="text-muted-foreground">Average sale price</span>
        <span>{formatCentsToDollars(data.avgSalePriceCents)}</span>
      </div>
      <div className="flex justify-between py-1 text-sm">
        <span className="text-muted-foreground">Effective fee rate</span>
        <span>{data.effectiveFeeRatePercent}%</span>
      </div>
      {data.cogsTotalCents > 0 && (
        <div className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">Gross margin</span>
          <span>{data.cogsMarginPercent}%</span>
        </div>
      )}
    </div>
  );
}

function BalanceSheetView({ data }: { data: BalanceSheetData }) {
  return (
    <div className="divide-y">
      <SectionLabel label="Assets" />
      <LineItem label="Available for payout" valueCents={data.assets.availableForPayoutCents} indent />
      <LineItem label="Pending (in escrow)" valueCents={data.assets.pendingCents} indent />
      <LineItem label={`Inventory value (${data.assets.inventoryCount} items)`} valueCents={data.assets.inventoryValueCents} indent />
      <LineItem label="Total assets" valueCents={data.assets.totalCurrentAssetsCents} bold />

      <SectionLabel label="Liabilities" />
      <LineItem label="Reserved (holds)" valueCents={data.liabilities.reservedCents} indent />
      <LineItem label="Total liabilities" valueCents={data.liabilities.totalLiabilitiesCents} bold />

      <SectionLabel label="Equity" />
      <LineItem label="Net equity (assets \u2212 liabilities)" valueCents={data.equity.netEquityCents} indent />
      <LineItem label="Period net earnings" valueCents={data.equity.periodNetProfitCents} indent />
      <LineItem label="Total equity" valueCents={data.equity.totalEquityCents} bold />
    </div>
  );
}

function CashFlowView({ data }: { data: CashFlowData }) {
  return (
    <div className="divide-y">
      <SectionLabel label="Operating Activities" />
      <LineItem label="Sales received" valueCents={data.operating.salesReceivedCents} indent />
      {data.operating.refundsIssuedCents > 0 && <LineItem label="Refunds issued" valueCents={data.operating.refundsIssuedCents} indent negative />}
      <LineItem label="Platform fees paid" valueCents={data.operating.platformFeesPaidCents} indent negative />
      {data.operating.shippingCostsCents > 0 && <LineItem label="Shipping costs" valueCents={data.operating.shippingCostsCents} indent negative />}
      {data.operating.operatingExpensesCents > 0 && <LineItem label="Operating expenses" valueCents={data.operating.operatingExpensesCents} indent negative />}
      {data.operating.mileageDeductionCents > 0 && <LineItem label="Mileage deductions" valueCents={data.operating.mileageDeductionCents} indent negative />}
      <LineItem label="Net operating activities" valueCents={data.operating.netOperatingCents} bold />

      <SectionLabel label="Financing Activities" />
      <LineItem label="Payouts sent" valueCents={data.financing.payoutsSentCents} indent negative />
      {data.financing.payoutsFailedReversedCents > 0 && <LineItem label="Payout reversals" valueCents={data.financing.payoutsFailedReversedCents} indent />}
      <LineItem label="Net financing activities" valueCents={data.financing.netFinancingCents} bold />

      <SectionLabel label="Summary" />
      <LineItem label="Net cash change" valueCents={data.netCashChangeCents} />
      <LineItem label="Beginning balance" valueCents={data.beginningBalanceCents} />
      <LineItem label="Ending balance" valueCents={data.endingBalanceCents} bold />
    </div>
  );
}

// Type guards for report snapshot JSON (stored as JSONB, retrieved as unknown)
function isPnlData(v: unknown): v is PnlReportData {
  return typeof v === 'object' && v !== null && 'grossRevenueCents' in v;
}
function isBalanceSheetData(v: unknown): v is BalanceSheetData {
  return typeof v === 'object' && v !== null && 'assets' in v && 'liabilities' in v;
}
function isCashFlowData(v: unknown): v is CashFlowData {
  return typeof v === 'object' && v !== null && 'operating' in v && 'financing' in v;
}

interface ReportViewerProps {
  report: SavedReport;
}

export function ReportViewer({ report }: ReportViewerProps) {
  const periodLabel = formatDateRange(new Date(report.periodStart), new Date(report.periodEnd));

  function renderContent() {
    if (report.reportType === 'PNL' && isPnlData(report.snapshotJson)) {
      return <PnlView data={report.snapshotJson} />;
    }
    if (report.reportType === 'BALANCE_SHEET' && isBalanceSheetData(report.snapshotJson)) {
      return <BalanceSheetView data={report.snapshotJson} />;
    }
    if (report.reportType === 'CASH_FLOW' && isCashFlowData(report.snapshotJson)) {
      return <CashFlowView data={report.snapshotJson} />;
    }
    return <p className="text-sm text-muted-foreground">Unsupported report type.</p>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base">{formatReportType(report.reportType)}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="no-print"
        >
          <Printer className="h-4 w-4 mr-1" />
          Print
        </Button>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
