import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByCategory, getSettingCategories } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PlatformSettingsTabs } from '@/components/admin/settings/platform-settings-tabs';

export const metadata: Metadata = { title: 'Platform Config | Twicely Hub' };

export default async function PlatformConfigPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const categories = getSettingCategories();
  const grouped = await getSettingsByCategory();

  // Map to the shape PlatformSettingsTabs expects
  const tabGrouped: Record<string, Array<{
    id: string;
    key: string;
    value: unknown;
    type: string;
    description: string | null;
    isSecret: boolean;
  }>> = {};

  for (const cat of categories) {
    tabGrouped[cat] = (grouped[cat] ?? []).map((s) => ({
      id: s.id,
      key: s.key,
      value: s.value,
      type: s.type,
      description: s.description,
      isSecret: s.isSecret,
    }));
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Config"
        description="All platform settings organized by category"
      />
      <PlatformSettingsTabs
        grouped={tabGrouped}
        categories={[...categories]}
        canEdit={canEdit}
      />
    </div>
  );
}
