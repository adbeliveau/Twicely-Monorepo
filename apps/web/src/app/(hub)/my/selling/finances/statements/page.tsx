import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { FinanceProGate } from '@/components/finance/finance-pro-gate';
import { StatementsClient } from '@/components/finance/statements-client';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Statements | Twicely',
  robots: 'noindex',
};

export default async function StatementsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/statements');
  }

  const sellerProfile = await getSellerProfile(session.userId);

  if (!sellerProfile) {
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
          <h1 className="text-2xl font-bold">Financial Statements</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Start Selling First</CardTitle>
            <CardDescription>
              Create your first listing to access financial statements.
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

  const [financeTier, annualCents, monthlyCents, retentionDaysFree, retentionYearsPro] =
    await Promise.all([
      getFinanceTier(session.userId),
      getPlatformSetting<number>('finance.pricing.pro.annualCents', 1199),
      getPlatformSetting<number>('finance.pricing.pro.monthlyCents', 1499),
      getPlatformSetting<number>('finance.reportRetentionDays.free', 30),
      getPlatformSetting<number>('finance.reportRetentionYears.pro', 2),
    ]);

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
        <h1 className="text-2xl font-bold">Financial Statements</h1>
        <p className="text-muted-foreground text-sm">
          Generate P&amp;L reports, balance sheets, and cash flow statements
        </p>
      </div>

      {financeTier === 'PRO' ? (
        <StatementsClient />
      ) : (
        <FinanceProGate
          annualMonthlyCents={annualCents}
          monthlyMonthlyCents={monthlyCents}
          retentionDaysFree={retentionDaysFree}
          retentionYearsPro={retentionYearsPro}
        />
      )}
    </div>
  );
}
