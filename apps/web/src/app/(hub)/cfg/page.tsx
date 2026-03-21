import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys, getSettingsOverview } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SettingsSearch } from '@/components/admin/settings/settings-search';
import { SettingsQuickLinks } from '@/components/admin/settings/settings-quick-links';
import { SettingsHubForm } from '@/components/admin/settings/settings-hub-form';
import { SettingsOverviewCards } from '@/components/admin/settings/settings-overview-cards';
import { RecentChanges } from '@/components/admin/settings/recent-changes';

export const metadata: Metadata = { title: 'Platform Settings | Twicely Hub' };

const GENERAL_KEYS = [
  'general.siteName', 'general.supportEmail', 'general.siteDescription',
  'general.maintenanceMode', 'general.registrationEnabled', 'general.sellerRegistrationEnabled',
  'general.defaultCurrency', 'general.minListingPriceCents', 'general.maxListingPriceCents',
  'general.staffInactivityTimeoutMinutes', 'general.userInactivityTimeoutMinutes',
  'general.userSessionMaxDays',
];

export default async function SettingsHubPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const [settings, overview] = await Promise.all([
    getSettingsByKeys(GENERAL_KEYS),
    getSettingsOverview(),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Settings"
        description="Configure global platform settings and preferences"
      />

      <SettingsSearch />

      {/* Overview stats and category breakdown */}
      <SettingsOverviewCards overview={overview} />

      {/* All Platform Settings Banner */}
      <Link
        href="/cfg/platform"
        className="flex items-center justify-between rounded-lg border-2 border-blue-200 bg-blue-50 p-5 shadow transition hover:border-blue-400 hover:shadow-md"
      >
        <div>
          <p className="text-lg font-semibold text-primary">All Platform Settings</p>
          <p className="text-sm text-gray-600">
            {overview.totalSettings}+ configurable settings — Fees, Commerce, Fulfillment, Trust, Discovery, Communications, Privacy
          </p>
        </div>
        <svg className="h-6 w-6 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* Quick Links */}
      <SettingsQuickLinks />

      {/* Recent Changes */}
      <RecentChanges changes={overview.recentChanges} />

      {/* General Settings Sections */}
      <SettingsHubForm
        dbSettings={settings.map((s) => ({ id: s.id, key: s.key, value: s.value }))}
        canEdit={canEdit}
      />
    </div>
  );
}
