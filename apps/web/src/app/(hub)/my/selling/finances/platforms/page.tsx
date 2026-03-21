import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getRevenueByPlatform } from '@/lib/queries/revenue-by-platform';
import { formatCentsToDollars } from '@twicely/finance/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Revenue by Platform | Twicely',
  robots: 'noindex',
};

/** Standard fee rates for comparison (display only — informational) */
const PLATFORM_FEE_LABELS: Record<string, string> = {
  TWICELY: 'Twicely (Transaction Fee)',
  EBAY: 'eBay (12.9%)',
  POSHMARK: 'Poshmark (20%)',
  MERCARI: 'Mercari (10%)',
  DEPOP: 'Depop (10%)',
  FB_MARKETPLACE: 'Facebook Marketplace (5%)',
  ETSY: 'Etsy (13%)',
  GRAILED: 'Grailed (10%)',
  THEREALREAL: 'The RealReal (20%)',
};

export default async function PlatformsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/platforms');
  }

  // Default to last 90 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const platforms = await getRevenueByPlatform(session.userId, startDate, endDate);

  // Find the highest-fee external platform for savings callout
  const externalPlatforms = platforms.filter((p) => p.channel !== 'TWICELY');
  const twicelySales = platforms.find((p) => p.channel === 'TWICELY');

  let savingsMessage: string | null = null;
  if (twicelySales && externalPlatforms.length > 0) {
    const highestFeeExternal = externalPlatforms.reduce((best, curr) =>
      curr.feesCents > best.feesCents ? curr : best,
    );
    const twicelyCents = twicelySales.feesCents;
    const externalCents = highestFeeExternal.feesCents;
    if (externalCents > twicelyCents) {
      const diff = externalCents - twicelyCents;
      const label = PLATFORM_FEE_LABELS[highestFeeExternal.channel] ?? highestFeeExternal.channel;
      savingsMessage = `Twicely saved you ${formatCentsToDollars(diff)} compared to selling everything on ${label}.`;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revenue by Platform</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-platform sales summary for the last 90 days. Off-platform data is informational — funds
          are not processed by Twicely.
        </p>
      </div>

      {savingsMessage && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-green-800 dark:text-green-300">{savingsMessage}</p>
          </CardContent>
        </Card>
      )}

      {platforms.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
            No sales data for the selected period.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Platform Breakdown</CardTitle>
            <CardDescription>Gross sales, platform fees, and net after fees per channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Platform</th>
                    <th className="pb-3 pr-4 text-right font-medium">Gross Sales</th>
                    <th className="pb-3 pr-4 text-right font-medium">Platform Fees</th>
                    <th className="pb-3 pr-4 text-right font-medium">Net Earnings</th>
                    <th className="pb-3 text-right font-medium">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => (
                    <tr key={p.channel} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">
                        {PLATFORM_FEE_LABELS[p.channel] ?? p.channel}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCentsToDollars(p.revenueCents)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-red-600 dark:text-red-400">
                        -{formatCentsToDollars(p.feesCents)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums font-medium">
                        {formatCentsToDollars(p.netCents)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {p.orderCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
