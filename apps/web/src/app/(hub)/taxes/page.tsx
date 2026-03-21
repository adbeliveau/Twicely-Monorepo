import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTaxRuleSettings } from '@/lib/queries/admin-tax-rules';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Tax Rules | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function TaxRulesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PlatformConfig')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const settings = await getTaxRuleSettings();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Tax Rules"
        description="Platform tax configuration and rules."
      />

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <p className="text-sm text-amber-800">
            Tax compliance is managed per-jurisdiction. These settings control
            platform-wide tax behavior.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tax settings configured.</p>
          ) : (
            <dl className="space-y-3">
              {settings.map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4">
                  <div>
                    <dt className="text-sm font-mono text-muted-foreground">{row.key}</dt>
                    {row.description && (
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    )}
                  </div>
                  <dd className="text-sm font-medium">{String(row.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
