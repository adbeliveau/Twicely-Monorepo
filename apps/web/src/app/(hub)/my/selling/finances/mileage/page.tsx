import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { getMileageList, getMileagePeriodSummary } from '@/lib/queries/finance-center-mileage';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { FinanceProGate } from '@/components/finance/finance-pro-gate';
import { MileageList } from '@/components/finance/mileage-list';
import { formatCentsToDollars } from '@twicely/finance/format';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mileage Tracking | Twicely',
  robots: 'noindex',
};

export default async function MileagePage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/mileage');
  }

  const sellerProfile = await getSellerProfile(session.userId);

  if (!sellerProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Mileage Tracker</h1>
        <Card>
          <CardHeader>
            <CardTitle>Start Selling First</CardTitle>
            <CardDescription>
              Create your first listing to access mileage tracking.
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
        <h1 className="text-2xl font-bold">Mileage Tracker</h1>
        <FinanceProGate
          annualMonthlyCents={annualCents}
          monthlyMonthlyCents={monthlyCents}
          retentionDaysFree={retentionDaysFree}
          retentionYearsPro={retentionYearsPro}
        />
      </div>
    );
  }

  const [initialData, summary, irsRate] = await Promise.all([
    getMileageList(session.userId, {
      page: 1,
      pageSize: 20,
      sortBy: 'tripDate',
      sortOrder: 'desc',
    }),
    getMileagePeriodSummary(session.userId, 30),
    getPlatformSetting<number>('finance.mileageRatePerMile', 0.70),
  ]);

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
        <h1 className="text-2xl font-bold">Mileage Tracker</h1>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {summary.totalMiles.toFixed(1)} mi
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {formatCentsToDollars(summary.totalDeductionCents)} estimated deduction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">IRS Rate &amp; Trips</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              ${irsRate.toFixed(2)}<span className="text-base font-normal">/mile</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.tripCount} trip{summary.tripCount !== 1 ? 's' : ''} logged
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mileage list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Trips</CardTitle>
        </CardHeader>
        <CardContent>
          <MileageList initialData={initialData} irsRate={irsRate} />
        </CardContent>
      </Card>
    </div>
  );
}
