import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getModules, getModuleStats, getModuleById } from '@/lib/queries/admin-modules';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ModulesGrid } from '@/components/admin/settings/modules-grid';

export const metadata: Metadata = { title: 'Modules | Twicely Hub' };

export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Module')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Module');
  const params = await searchParams;
  const [modules, stats, selectedModule] = await Promise.all([
    getModules(),
    getModuleStats(),
    params.module ? getModuleById(params.module) : Promise.resolve(null),
  ]);

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

      {selectedModule && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
          <h3 className="mb-3 text-sm font-semibold text-primary">
            Module Detail — {selectedModule.label}
          </h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-gray-500">Module ID</dt>
              <dd className="font-mono text-gray-900">{selectedModule.moduleId}</dd>
            </div>
            <div>
              <dt className="text-gray-500">State</dt>
              <dd className="font-medium text-gray-900">{selectedModule.state}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Version</dt>
              <dd className="font-medium text-gray-900">{selectedModule.version}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Config Path</dt>
              <dd className="font-mono text-gray-900">{selectedModule.configPath ?? '—'}</dd>
            </div>
          </dl>
          {selectedModule.description && (
            <p className="mt-3 text-sm text-gray-600">{selectedModule.description}</p>
          )}
        </div>
      )}

      <ModulesGrid modules={modules} canEdit={canEdit} />
    </div>
  );
}
