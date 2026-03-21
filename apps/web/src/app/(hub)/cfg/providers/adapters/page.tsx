import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdapters } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Provider Adapters | Twicely Hub' };

const SERVICE_TYPE_LABELS: Record<string, string> = {
  STORAGE: 'Storage',
  EMAIL: 'Email',
  SEARCH: 'Search',
  SMS: 'SMS',
  PUSH: 'Push Notifications',
  PAYMENTS: 'Payments',
  SHIPPING: 'Shipping',
  REALTIME: 'Real-time',
  CACHE: 'Cache & Queues',
  CROSSLISTER: 'Crosslister Channels',
};

export default async function AdaptersPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderAdapter')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const adapters = await getAdapters();
  const canCreate = ability.can('create', 'ProviderInstance');

  // Group by service type
  const grouped = new Map<string, typeof adapters>();
  for (const adapter of adapters) {
    const group = grouped.get(adapter.serviceType) ?? [];
    group.push(adapter);
    grouped.set(adapter.serviceType, group);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Provider Adapters"
        description="Registered service adapters — create instances to configure API keys and settings"
      />

      {adapters.length === 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            No adapters found. Run <code className="rounded bg-yellow-100 px-1">pnpm db:seed</code> to register built-in providers.
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([serviceType, group]) => (
        <div key={serviceType}>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            {SERVICE_TYPE_LABELS[serviceType] ?? serviceType}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.map((adapter) => (
              <div key={adapter.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary">{adapter.name}</h3>
                  {adapter.isBuiltIn && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Built-in</span>
                  )}
                </div>
                {adapter.description && (
                  <p className="mt-1 text-xs text-gray-500">{adapter.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  {canCreate && (
                    <Link
                      href={`/cfg/providers/instances/new?adapter=${adapter.id}`}
                      className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800"
                    >
                      Create Instance
                    </Link>
                  )}
                  {adapter.docsUrl && (
                    <a href={adapter.docsUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800">Docs</a>
                  )}
                  <span className={`text-xs ${adapter.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {adapter.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
