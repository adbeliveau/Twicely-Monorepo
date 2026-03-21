import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getProviderOverview } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProviderHealthCard } from '@/components/admin/settings/provider-health-card';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Providers | Twicely Hub' };

export default async function ProvidersOverviewPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderAdapter')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const overview = await getProviderOverview();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Providers"
        description="Service provider health and configuration overview"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ProviderHealthCard title="Total Adapters" value={overview.totalAdapters} status="gray" />
        <ProviderHealthCard title="Total Instances" value={overview.totalInstances} status="gray" />
        <ProviderHealthCard title="Healthy" value={overview.healthyInstances} status="green" />
        <ProviderHealthCard title="Unhealthy" value={overview.unhealthyInstances} status={overview.unhealthyInstances > 0 ? 'red' : 'green'} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-primary">Quick Setup</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Stripe', href: '/cfg/stripe', desc: 'Payment processing, Connect payouts, and billing' },
            { label: 'Shippo', href: '/cfg/shippo', desc: 'Multi-carrier shipping rates and label generation' },
          ].map((link) => (
            <Link key={link.href} href={link.href}
              className="rounded-lg border border-blue-200 bg-blue-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-100">
              <p className="text-sm font-medium text-blue-900">{link.label}</p>
              <p className="mt-1 text-xs text-blue-700">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-primary">Management</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Adapters', href: '/cfg/providers/adapters', desc: 'View all registered service adapters and create instances' },
            { label: 'Instances', href: '/cfg/providers/instances', desc: 'Manage provider instances, test connections, and configure settings' },
            { label: 'Usage Mappings', href: '/cfg/providers/mappings', desc: 'Configure primary and fallback routing for each service' },
            { label: 'Health Logs', href: '/cfg/providers/health', desc: 'View health check history and response times' },
          ].map((link) => (
            <Link key={link.href} href={link.href}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50">
              <p className="text-sm font-medium text-primary">{link.label}</p>
              <p className="mt-1 text-xs text-gray-500">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {overview.recentIssues.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-primary">Recent Issues</h2>
          <div className="rounded-lg border border-gray-200 bg-white">
            {overview.recentIssues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-b-0">
                <div>
                  <span className="text-sm font-medium text-gray-900">{issue.instanceName}</span>
                  <span className="ml-2 text-xs text-red-600">{issue.status}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(issue.checkedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
