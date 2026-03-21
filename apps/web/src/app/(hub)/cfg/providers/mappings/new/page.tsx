import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getInstances } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { MappingCreateForm } from '@/components/admin/settings/mapping-create-form';
import Link from 'next/link';

export const metadata: Metadata = { title: 'New Usage Mapping | Twicely Hub' };

export default async function NewMappingPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'ProviderUsageMapping')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const instances = await getInstances();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg/providers" className="hover:text-gray-700">Providers</Link>
        <span>/</span>
        <Link href="/cfg/providers/mappings" className="hover:text-gray-700">Usage Mappings</Link>
        <span>/</span>
        <span className="text-gray-900">New</span>
      </div>

      <AdminPageHeader
        title="New Usage Mapping"
        description="Route a service usage key to primary and fallback provider instances"
      />

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <MappingCreateForm
          instances={instances.map((i) => ({
            id: i.id,
            displayName: i.displayName,
            adapterName: i.adapterName,
            status: i.status,
          }))}
        />
      </div>
    </div>
  );
}
