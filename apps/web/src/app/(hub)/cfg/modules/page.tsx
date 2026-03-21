import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getModules, getModuleStats } from '@/lib/queries/admin-modules';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ModulesGrid } from '@/components/admin/settings/modules-grid';

export const metadata: Metadata = { title: 'Modules | Twicely Hub' };

export default async function ModulesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Module')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Module');
  const [modules, stats] = await Promise.all([getModules(), getModuleStats()]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Modules"
        description="Enable, disable, and manage platform modules"
      />

      {/* Stats bar */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-semibold text-primary">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
          <p className="text-xs text-gray-500">Enabled</p>
          <p className="text-lg font-semibold text-green-600">{stats.enabled}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2">
          <p className="text-xs text-gray-500">Disabled</p>
          <p className="text-lg font-semibold text-gray-500">{stats.disabled}</p>
        </div>
      </div>

      <ModulesGrid modules={modules} canEdit={canEdit} />
    </div>
  );
}
