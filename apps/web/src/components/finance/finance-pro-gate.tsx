import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { formatCentsToDollars } from '@twicely/finance/format';

interface FinanceProGateProps {
  annualMonthlyCents: number;
  monthlyMonthlyCents: number;
  retentionDaysFree: number;
  retentionYearsPro: number;
}

const PRO_FEATURES = [
  'Expense tracking with categories and receipts',
  'Mileage tracking with IRS rate deductions',
  'Full P&L reports (PDF + CSV export)',
  '2-year transaction history',
  'Balance sheet and cash flow reports',
  'Tax prep summary export',
];

const FREE_FEATURES = [
  '30-day transaction history (read-only)',
  'Revenue and fee dashboard',
  'P&L summary (read-only)',
];

export function FinanceProGate({
  annualMonthlyCents,
  monthlyMonthlyCents,
  retentionYearsPro,
}: FinanceProGateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Finance Pro</CardTitle>
        <CardDescription>
          Upgrade to Finance Pro for full expense tracking, reports, and{' '}
          {retentionYearsPro}-year history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Annual (save 33%)</p>
            <p className="text-2xl font-bold">{formatCentsToDollars(annualMonthlyCents)}</p>
            <p className="text-xs text-muted-foreground">per month</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Monthly</p>
            <p className="text-2xl font-bold">{formatCentsToDollars(monthlyMonthlyCents)}</p>
            <p className="text-xs text-muted-foreground">per month</p>
          </div>
        </div>

        {/* Feature comparison */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2">Free (current)</p>
            <ul className="space-y-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Finance Pro</p>
            <ul className="space-y-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-green-700">
                  <Check className="h-3 w-3 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button asChild className="w-full">
          <Link href="/my/selling/subscription">Upgrade to Finance Pro</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
