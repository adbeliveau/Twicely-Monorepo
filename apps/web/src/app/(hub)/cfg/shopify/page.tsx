import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Shopify Settings | Twicely Hub' };

export default async function ShopifySettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('shopify'),
    getConnectorStats('SHOPIFY'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Shopify Settings" description="Shopify OAuth credentials and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Shopify</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'shopify',
          displayName: 'Shopify',
          authType: 'OAUTH',
          callbackUrl: 'https://twicely.co/api/crosslister/shopify/callback',
          settingsPrefix: 'crosslister.shopify',
          description: 'Tier A connector — Full REST API with webhooks. Per-store OAuth install flow.',
          docsUrl: 'https://shopify.dev/docs/apps/auth/get-access-tokens/authorization-code-grant',
          webhookConfig: {
            url: 'https://twicely.co/api/crosslister/shopify/webhook',
            events: [
              'products/create', 'products/update', 'products/delete',
              'orders/create', 'orders/paid',
              'app/uninstalled',
            ],
          },
          capabilities: {
            canImport: true, canPublish: true, canUpdate: true, canDelist: true,
            hasWebhooks: true, canShare: false, canAutoRelist: false, canMakeOffers: false,
            maxImagesPerListing: 250, maxTitleLength: 255, maxDescriptionLength: 65535,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
