import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Mercari Settings | Twicely Hub' };

export default async function MercariSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('mercari'),
    getConnectorStats('MERCARI'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Mercari Settings" description="Mercari OAuth credentials and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Mercari</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'mercari',
          displayName: 'Mercari',
          authType: 'OAUTH',
          callbackUrl: 'https://twicely.co/api/crosslister/mercari/callback',
          settingsPrefix: 'crosslister.mercari',
          description: 'Tier B connector — OAuth with listings and profile access.',
          docsUrl: 'https://www.mercari.com/us/help_center/',
          capabilities: {
            canImport: true, canPublish: true, canUpdate: true, canDelist: true,
            hasWebhooks: false, canShare: false, canAutoRelist: false, canMakeOffers: false,
            maxImagesPerListing: 12, maxTitleLength: 80, maxDescriptionLength: 1000,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
