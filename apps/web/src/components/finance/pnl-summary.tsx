import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FinanceDashboardKPIs } from '@/lib/queries/finance-center';
import type { ExpenseSummaryResult, MileageSummaryResult } from '@/lib/queries/finance-center';

// Canonical §5 null-COGS tooltip text (Financial Center Canonical v3.0)
const COGS_MISSING_TOOLTIP = 'Add your item cost to calculate profit';

interface PnlSummaryProps {
  kpis: FinanceDashboardKPIs;
  expenses: ExpenseSummaryResult;
  mileage: MileageSummaryResult;
  financeTier: 'FREE' | 'PRO';
}

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
      <span className={negative ? 'text-red-600' : bold ? '' : ''}>{display}</span>
    </div>
  );
}

interface CogsLineItemProps {
  label: string;
  valueCents: number;
  indent?: boolean;
  bold?: boolean;
  negative?: boolean;
  cogsIncomplete: boolean;
}

// A line item that always renders. When cogsIncomplete is true it shows "—" + tooltip
// instead of a formatted dollar amount. Used for COGS, Gross Profit, and Net Profit rows.
function CogsAwareLineItem({
  label,
  valueCents,
  indent,
  bold,
  negative,
  cogsIncomplete,
}: CogsLineItemProps) {
  if (!cogsIncomplete) {
    return (
      <LineItem
        label={label}
        valueCents={valueCents}
        indent={indent}
        bold={bold}
        negative={negative}
      />
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <div
          className={`flex justify-between items-center py-1 ${indent ? 'pl-4' : ''} ${
            bold ? 'font-semibold' : 'text-sm'
          }`}
        >
          <span className={bold ? '' : 'text-muted-foreground'}>{label}</span>
          {/* TooltipTrigger wraps only the dash glyph — Radix handles portal placement */}
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-help text-muted-foreground bg-transparent border-0 p-0 text-sm font-inherit leading-inherit"
              aria-label={COGS_MISSING_TOOLTIP}
            >
              —
            </button>
          </TooltipTrigger>
        </div>
        <TooltipContent>{COGS_MISSING_TOOLTIP}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Canonical P&L formula (Financial Center Canonical §6):
// Gross Revenue
// - COGS
// = Gross Profit
// - Platform Fees (TF + Stripe + Boost)
// - Shipping Costs
// = Net After Fees
// - Operating Expenses (manual expenses)
// - Mileage Deductions
// = Net Profit
export function PnlSummary({ kpis, expenses, mileage, financeTier }: PnlSummaryProps) {
  // Canonical §5: cogsTotalCents === 0 means no COGS data — treat as incomplete.
  // Real zero-COGS sellers do not exist (every item has a sourcing cost).
  const cogsIncomplete = kpis.cogsTotalCents === 0;
  const grossProfit = kpis.grossRevenueCents - kpis.cogsTotalCents;

  const netProfit =
    kpis.grossRevenueCents -
    kpis.cogsTotalCents -
    kpis.totalFeesCents -
    kpis.shippingCostsCents -
    expenses.totalExpensesCents -
    mileage.totalDeductionCents;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">P&amp;L Summary (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          <LineItem label="Gross revenue" valueCents={kpis.grossRevenueCents} />

          {/* COGS row — always rendered; shows "—" + tooltip when incomplete (canonical §5) */}
          <CogsAwareLineItem
            label="Cost of goods sold"
            valueCents={kpis.cogsTotalCents}
            indent
            negative
            cogsIncomplete={cogsIncomplete}
          />

          {/* Gross Profit — always rendered; shows "—" when COGS incomplete */}
          <div className="pt-1 pb-1">
            <CogsAwareLineItem
              label="Gross profit"
              valueCents={grossProfit}
              bold
              cogsIncomplete={cogsIncomplete}
            />
          </div>

          <LineItem
            label="Transaction Fee"
            valueCents={kpis.tfFeesCents}
            indent
            negative
          />
          <LineItem
            label="Payment processing fee"
            valueCents={kpis.stripeFeesCents}
            indent
            negative
          />
          {kpis.boostFeesCents > 0 && (
            <LineItem
              label="Boost fees"
              valueCents={kpis.boostFeesCents}
              indent
              negative
            />
          )}
          {kpis.shippingCostsCents > 0 && (
            <LineItem
              label="Shipping costs"
              valueCents={kpis.shippingCostsCents}
              indent
              negative
            />
          )}
          {expenses.totalExpensesCents > 0 ? (
            <LineItem
              label="Business expenses"
              valueCents={expenses.totalExpensesCents}
              indent
              negative
            />
          ) : financeTier === 'FREE' ? (
            <div className="py-2 pl-4 text-xs text-muted-foreground">
              Track expenses with Finance Pro
            </div>
          ) : null}
          {mileage.totalDeductionCents > 0 && (
            <LineItem
              label="Mileage deductions"
              valueCents={mileage.totalDeductionCents}
              indent
              negative
            />
          )}

          {/* Net earnings — shows "—" when COGS incomplete (can't compute honest profit) */}
          <div className="pt-2">
            <CogsAwareLineItem
              label="Net earnings"
              valueCents={netProfit}
              bold
              cogsIncomplete={cogsIncomplete}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

