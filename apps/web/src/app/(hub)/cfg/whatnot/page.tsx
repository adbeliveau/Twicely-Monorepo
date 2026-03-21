import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ConnectorSettingsPage } from '@/components/admin/settings/connector-settings-page';
import { getConnectorSettings, getConnectorStats } from '@/lib/queries/admin-connector-settings';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Whatnot Settings | Twicely Hub' };

export default async function WhatnotSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [settings, stats] = await Promise.all([
    getConnectorSettings('whatnot'),
    getConnectorStats('WHATNOT'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Whatnot Settings" description="Whatnot OAuth credentials and crosslister settings" />
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <span className="text-gray-900">Whatnot</span>
      </div>
      <ConnectorSettingsPage
        config={{
          code: 'whatnot',
          displayName: 'Whatnot',
          authType: 'OAUTH',
          callbackUrl: 'https://twicely.co/api/crosslister/whatnot/callback',
          settingsPrefix: 'crosslister.whatnot',
          description: 'Tier B connector — OAuth with GraphQL Seller API. BIN listings + inventory management.',
          docsUrl: 'https://developers.whatnot.com/docs/getting-started/authentication',
          capabilities: {
            canImport: true, canPublish: true, canUpdate: true, canDelist: true,
            hasWebhooks: false, canShare: false, canAutoRelist: false, canMakeOffers: false,
            maxImagesPerListing: 10, maxTitleLength: 200, maxDescriptionLength: 5000,
          },
        }}
        settings={settings}
        stats={stats}
        canEdit={ability.can('update', 'Setting')}
      />
    </div>
  );
}
