import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';
import type { ExpenseSummaryResult } from '@/lib/queries/finance-center';
import Link from 'next/link';

interface ExpenseSummaryCardProps {
  expenses: ExpenseSummaryResult;
  financeTier: 'FREE' | 'PRO';
}

export function ExpenseSummaryCard({ expenses, financeTier }: ExpenseSummaryCardProps) {
  if (expenses.totalExpensesCents === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Expenses</CardTitle>
            {financeTier === 'PRO' && (
              <Link
                href="/my/selling/finances/expenses"
                className="text-sm text-primary underline underline-offset-2"
              >
                View all
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {financeTier === 'FREE'
              ? 'No expenses tracked yet. Upgrade to Finance Pro to start tracking.'
              : 'No expenses in the last 30 days.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Expenses</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">
              {formatCentsToDollars(expenses.totalExpensesCents)} total
            </span>
            {financeTier === 'PRO' && (
              <Link
                href="/my/selling/finances/expenses"
                className="text-sm text-primary underline underline-offset-2"
              >
                View all
              </Link>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {expenses.expensesByCategory.map((cat) => (
            <div key={cat.category} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground capitalize">
                {cat.category.toLowerCase().replace(/_/g, ' ')}
                <span className="ml-1 text-xs">({cat.count})</span>
              </span>
              <span>{formatCentsToDollars(cat.totalCents)}</span>
            </div>
          ))}
        </div>
        {financeTier === 'FREE' && (
          <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
            Read-only view.{' '}
            <Link
              href="/my/selling/subscription"
              className="text-primary underline underline-offset-2"
            >
              Upgrade to Finance Pro
            </Link>{' '}
            to add and manage expenses.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
