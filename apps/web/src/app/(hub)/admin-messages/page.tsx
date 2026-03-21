import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getBroadcastSettings } from '@/lib/queries/admin-broadcast';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BroadcastSettingsList } from '@/components/admin/broadcast-settings-list';

export const metadata: Metadata = {
  title: 'Admin Messages | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function AdminMessagesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const settings = await getBroadcastSettings();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Messages"
        description="Manage broadcast messages shown across the platform."
      />
      {settings.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">
          No broadcast settings configured. Add broadcast.* keys in platform settings.
        </p>
      ) : (
        <BroadcastSettingsList settings={settings} canEdit={canEdit} />
      )}
    </div>
  );
}
