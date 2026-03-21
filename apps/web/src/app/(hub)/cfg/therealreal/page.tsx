import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'The RealReal Settings | Twicely Hub' };

export default async function TheRealRealSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('therealreal'),
    getConnectorStats('THEREALREAL'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="The RealReal Settings" description="The RealReal session-based connection and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">The RealReal</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'therealreal',
          displayName: 'The RealReal',
          authType: 'SESSION',
          settingsPrefix: 'crosslister.therealreal',
          description: 'Tier C connector — session-based (internal API). Consignment model.',
          docsUrl: 'https://www.therealreal.com/faq',
          capabilities: {
            canImport: true, canPublish: true, canUpdate: false, canDelist: true,
            hasWebhooks: false, canShare: false, canAutoRelist: false, canMakeOffers: false,
            maxImagesPerListing: 12, maxTitleLength: 80, maxDescriptionLength: 2000,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
