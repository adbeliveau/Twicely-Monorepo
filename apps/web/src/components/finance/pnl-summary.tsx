import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';
import type { FinanceDashboardKPIs } from '@/lib/queries/finance-center';
import type { ExpenseSummaryResult, MileageSummaryResult } from '@/lib/queries/finance-center';

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

// Canonical P&L formula (Financial Center Canonical section 6):
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
  const hasCogs = kpis.cogsTotalCents > 0;
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

          {hasCogs && (
            <LineItem
              label="Cost of goods sold"
              valueCents={kpis.cogsTotalCents}
              indent
              negative
            />
          )}

          {hasCogs && (
            <div className="pt-1 pb-1">
              <LineItem
                label="Gross profit"
                valueCents={grossProfit}
                bold
              />
            </div>
          )}

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
          <div className="pt-2">
            <LineItem
              label="Net earnings"
              valueCents={netProfit}
              bold
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
