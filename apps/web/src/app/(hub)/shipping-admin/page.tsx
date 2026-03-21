import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getShippingAdminSettings } from '@/lib/queries/admin-shipping';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';

export const metadata: Metadata = {
  title: 'Shipping Admin | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function ShippingAdminPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PlatformConfig')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const settings = await getShippingAdminSettings();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Shipping Admin"
        description="Global shipping settings and carrier configuration."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/cfg/shippo">Shippo API Config</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shipping Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shipping settings configured.</p>
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

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Carrier API keys and Shippo integration settings are managed via{' '}
            <Link href="/cfg/shippo" className="text-primary underline underline-offset-4">
              Shippo API Config
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
