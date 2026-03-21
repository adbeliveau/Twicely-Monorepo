import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getUsageMappings } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { UsageMappingCard } from '@/components/admin/settings/usage-mapping-card';

export const metadata: Metadata = { title: 'Usage Mappings | Twicely Hub' };

export default async function MappingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderUsageMapping')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const mappings = await getUsageMappings();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Usage Mappings"
        description="Route service requests to primary and fallback provider instances"
      />

      {mappings.length === 0 ? (
        <p className="text-sm text-gray-400">No usage mappings configured.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mappings.map((m) => (
            <UsageMappingCard
              key={m.id}
              usageKey={m.usageKey}
              description={m.description}
              serviceType={m.serviceType}
              primaryInstanceName={m.primaryInstanceName}
              fallbackInstanceName={m.fallbackInstanceName}
              autoFailover={m.autoFailover}
              enabled={m.enabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
