import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { FinanceProGate } from '@/components/finance/finance-pro-gate';
import { ChevronLeft } from 'lucide-react';
import { ReportsClient } from './reports-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reports | Twicely',
  robots: 'noindex',
};

export default async function ReportsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/reports');
  }

  const sellerProfile = await getSellerProfile(session.userId);

  if (!sellerProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Create your first listing to access reports.</p>
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
        <h1 className="text-2xl font-bold">Reports</h1>
        <FinanceProGate
          annualMonthlyCents={annualCents}
          monthlyMonthlyCents={monthlyCents}
          retentionDaysFree={retentionDaysFree}
          retentionYearsPro={retentionYearsPro}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/my/selling/finances"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Finances
        </Link>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate P&amp;L statements, balance sheets, and cash flow reports.
        </p>
      </div>

      <ReportsClient />
    </div>
  );
}
