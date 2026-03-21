import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Etsy Settings | Twicely Hub' };

export default async function EtsySettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('etsy'),
    getConnectorStats('ETSY'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Etsy Settings" description="Etsy OAuth credentials, webhook config, and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Etsy</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'etsy',
          displayName: 'Etsy',
          authType: 'OAUTH',
          callbackUrl: 'https://twicely.co/api/crosslister/etsy/callback',
          settingsPrefix: 'crosslister.etsy',
          description: 'Tier A connector — full OAuth with listings and profile scopes.',
          docsUrl: 'https://developers.etsy.com/documentation',
          webhookConfig: {
            url: 'https://twicely.co/api/webhooks/etsy',
            events: ['listing.sold', 'listing.expired', 'listing.updated', 'receipt.created'],
          },
          capabilities: {
            canImport: true, canPublish: true, canUpdate: true, canDelist: true,
            hasWebhooks: true, canShare: false, canAutoRelist: true, canMakeOffers: true,
            maxImagesPerListing: 10, maxTitleLength: 140, maxDescriptionLength: 5000,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
