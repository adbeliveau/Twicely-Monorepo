import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'eBay Settings | Twicely Hub' };

export default async function EbaySettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('ebay'),
    getConnectorStats('EBAY'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="eBay Settings" description="eBay OAuth credentials, webhook config, and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">eBay</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'ebay',
          displayName: 'eBay',
          authType: 'OAUTH',
          callbackUrl: 'https://twicely.co/api/crosslister/ebay/callback',
          settingsPrefix: 'crosslister.ebay',
          description: 'Tier A connector — full OAuth with inventory and account scopes.',
          docsUrl: 'https://developer.ebay.com/docs',
          webhookConfig: {
            url: 'https://twicely.co/api/webhooks/ebay',
            events: [
              'ITEM_SOLD', 'ITEM_CLOSED', 'ITEM_REVISED',
              'ITEM_RELISTED', 'ITEM_SUSPENDED', 'BID_RECEIVED',
            ],
          },
          capabilities: {
            canImport: true, canPublish: true, canUpdate: true, canDelist: true,
            hasWebhooks: true, canShare: false, canAutoRelist: true, canMakeOffers: true,
            maxImagesPerListing: 24, maxTitleLength: 80, maxDescriptionLength: 4000,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
