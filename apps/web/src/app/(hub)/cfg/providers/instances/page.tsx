import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getInstances } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { InstanceCard } from '@/components/admin/settings/instance-card';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Provider Instances | Twicely Hub' };

export default async function InstancesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderInstance')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const instances = await getInstances();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Provider Instances"
        description="Active provider instances with health status and controls"
      />

      {instances.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">No instances configured.</p>
          <Link href="/cfg/providers/adapters"
            className="inline-block rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
            Create from Adapters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst) => (
            <div key={inst.id} className="space-y-2">
              <InstanceCard
                id={inst.id}
                name={inst.name}
                displayName={inst.displayName}
                adapterName={inst.adapterName}
                status={inst.status}
                lastHealthStatus={inst.lastHealthStatus}
                lastHealthLatencyMs={inst.lastHealthLatencyMs}
                lastHealthCheckAt={inst.lastHealthCheckAt}
              />
              <Link href={`/cfg/providers/instances/${inst.id}`}
                className="block rounded-md border border-gray-200 px-3 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-50">
                Configure
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
