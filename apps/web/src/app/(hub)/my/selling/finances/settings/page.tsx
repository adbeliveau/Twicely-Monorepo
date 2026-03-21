import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getFinanceTier } from '@/lib/queries/finance-center';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { ChevronLeft } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/lib/validations/finance-center';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finance Settings | Twicely',
  robots: 'noindex',
};

export default async function FinanceSettingsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/settings');
  }

  const sellerProfile = await getSellerProfile(session.userId);

  if (!sellerProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Finance Settings</h1>
        <p className="text-muted-foreground">Create your first listing to access finance settings.</p>
      </div>
    );
  }

  const [financeTier, mileageRate, retentionDaysFree, retentionYearsPro] = await Promise.all([
    getFinanceTier(session.userId),
    getPlatformSetting<number>('finance.mileageRatePerMile', 0.70),
    getPlatformSetting<number>('finance.reportRetentionDays.free', 30),
    getPlatformSetting<number>('finance.reportRetentionYears.pro', 2),
  ]);

  const retentionLabel = financeTier === 'PRO'
    ? `${retentionYearsPro} year${retentionYearsPro !== 1 ? 's' : ''}`
    : `${retentionDaysFree} days`;

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
        <h1 className="text-2xl font-bold">Finance Settings</h1>
      </div>

      {/* Your Plan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your Plan</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={financeTier === 'PRO' ? 'default' : 'secondary'}
              className={financeTier === 'PRO' ? 'bg-[#7C3AED] hover:bg-[#6D28D9]' : ''}>
              {financeTier === 'PRO' ? 'Finance Pro' : 'Free'}
            </Badge>
          </div>
          <Link
            href="/my/selling/subscription"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            {financeTier === 'FREE' ? 'Upgrade' : 'Manage subscription'}
          </Link>
        </CardContent>
      </Card>

      {/* History Retention */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">History Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Your financial data is retained for <span className="font-medium">{retentionLabel}</span>.</p>
          {financeTier === 'FREE' && (
            <p className="text-xs text-muted-foreground mt-1">
              Upgrade to Finance Pro for {retentionYearsPro}-year history.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Expense Categories */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Expense Categories</CardTitle>
          <CardDescription>16 preset categories for tracking expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <Badge key={cat} variant="outline" className="text-xs">
                {cat}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Custom categories coming soon.</p>
        </CardContent>
      </Card>

      {/* Mileage Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mileage Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Current IRS rate: <span className="font-medium">${mileageRate.toFixed(2)}/mile (2026)</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">Set by the platform. Updated annually.</p>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Currency</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">USD</p>
          <p className="text-xs text-muted-foreground mt-1">All amounts are in US dollars.</p>
        </CardContent>
      </Card>
    </div>
  );
}
