import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPlatformSettingsByPrefix } from '@/lib/queries/platform-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Currency | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function CurrencyPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PlatformConfig')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const currencySettings = await getPlatformSettingsByPrefix('currency.');

  const entries = Array.from(currencySettings.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Currency"
        description="Platform currency configuration."
      />

      {/* Info banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            Multi-currency support is coming soon. Currently operating in USD only.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Currency Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No currency settings configured.</p>
          ) : (
            <dl className="space-y-3">
              {entries.map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <dt className="text-sm font-mono text-muted-foreground">{key}</dt>
                  <dd className="text-sm font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
