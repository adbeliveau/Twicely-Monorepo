import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Depop Settings | Twicely Hub' };

export default async function DepopSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('depop'),
    getConnectorStats('DEPOP'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Depop Settings" description="Depop OAuth credentials and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Depop</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'depop',
          displayName: 'Depop',
          authType: 'OAUTH',
          callbackUrl: 'https://twicely.co/api/crosslister/depop/callback',
          settingsPrefix: 'crosslister.depop',
          description: 'Tier B connector — OAuth with products and profile access.',
          docsUrl: 'https://www.depop.com/help/',
          capabilities: {
            canImport: true, canPublish: true, canUpdate: true, canDelist: true,
            hasWebhooks: false, canShare: false, canAutoRelist: false, canMakeOffers: false,
            maxImagesPerListing: 4, maxTitleLength: 80, maxDescriptionLength: 1000,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
