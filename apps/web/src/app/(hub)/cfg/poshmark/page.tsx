import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Poshmark Settings | Twicely Hub' };

export default async function PoshmarkSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('poshmark'),
    getConnectorStats('POSHMARK'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Poshmark Settings" description="Poshmark session-based connection and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Poshmark</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'poshmark',
          displayName: 'Poshmark',
          authType: 'SESSION',
          settingsPrefix: 'crosslister.poshmark',
          description: 'Tier C connector — session-based (internal mobile API). No public API available.',
          docsUrl: 'https://poshmark.com/faq',
          capabilities: {
            canImport: true, canPublish: true, canUpdate: false, canDelist: true,
            hasWebhooks: false, canShare: true, canAutoRelist: false, canMakeOffers: false,
            maxImagesPerListing: 16, maxTitleLength: 80, maxDescriptionLength: 1500,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
