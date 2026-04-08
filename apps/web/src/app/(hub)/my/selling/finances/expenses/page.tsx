import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { getExpenseList, getExpenseCategoryBreakdown } from '@/lib/queries/finance-center-expenses';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { FinanceProGate } from '@/components/finance/finance-pro-gate';
import { ExpenseList } from '@/components/finance/expense-list';
import { ExpenseCategoryChart } from '@/components/finance/expense-category-chart';
import { formatCentsToDollars } from '@twicely/finance/format';
import { EXPENSE_CATEGORIES } from '@/lib/validations/finance-center';
import { AddExpenseButton } from '@/components/finance/add-expense-button';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Expenses | Twicely',
  robots: 'noindex',
};

export default async function ExpensesPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/expenses');
  }

  const sellerProfile = await getSellerProfile(session.userId);

  if (!sellerProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Card>
          <CardHeader>
            <CardTitle>Start Selling First</CardTitle>
            <CardDescription>
              Create your first listing to access expense tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/my/selling/listings/new">Create Listing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const financeTier = await getFinanceTier(session.userId);

  if (financeTier === 'FREE') {
    const [annualCents, monthlyCents, retentionDaysFree, retentionYearsPro] = await Promise.all([
      getPlatformSetting<number>('finance.pricing.pro.annualCents', 1199),
      getPlatformSetting<number>('finance.pricing.pro.monthlyCents', 1499),
      getPlatformSetting<number>('finance.reportRetentionDays.free', 30),
      getPlatformSetting<number>('finance.reportRetentionYears.pro', 2),
    ]);

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <FinanceProGate
          annualMonthlyCents={annualCents}
          monthlyMonthlyCents={monthlyCents}
          retentionDaysFree={retentionDaysFree}
          retentionYearsPro={retentionYearsPro}
        />
      </div>
    );
  }

  const [initialData, breakdown] = await Promise.all([
    getExpenseList(session.userId, {
      page: 1,
      pageSize: 20,
      sortBy: 'expenseDate',
      sortOrder: 'desc',
    }),
    getExpenseCategoryBreakdown(session.userId, 30),
  ]);

  const totalBreakdownCents = breakdown.reduce(
    (sum, item) => sum + item.totalCents,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div>
        <Link
          href="/my/selling/finances"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Finances
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">Expenses</h1>
          <AddExpenseButton />
        </div>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCentsToDollars(totalBreakdownCents)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {initialData.total} expense{initialData.total !== 1 ? 's' : ''} tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Category (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseCategoryChart
              data={breakdown}
              totalCents={totalBreakdownCents}
            />
          </CardContent>
        </Card>
      </div>

      {/* Expense table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseList initialData={initialData} categories={EXPENSE_CATEGORIES} />
        </CardContent>
      </Card>
    </div>
  );
}
