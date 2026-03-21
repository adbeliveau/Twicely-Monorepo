import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPlatformSettingsByPrefix } from '@/lib/queries/platform-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Translations | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function TranslationsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'PlatformConfig')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const i18nSettings = await getPlatformSettingsByPrefix('i18n.');

  const entries = Array.from(i18nSettings.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Translations"
        description="Internationalization & language settings."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">i18n Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No i18n settings configured.</p>
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

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Translation content is managed by the development team. To update i18n settings,
            use the platform configuration at{' '}
            <span className="font-mono text-xs">/cfg</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
