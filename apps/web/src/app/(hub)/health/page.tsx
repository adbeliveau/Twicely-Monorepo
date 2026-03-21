import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getProviderHealthStatus } from '@/lib/queries/health-checks';
import { HealthStatusBanner } from '@/components/admin/health-status-banner';
import { HealthStatusCard } from '@/components/admin/health-status-card';
import { RunChecksButton } from '@/components/admin/run-checks-button';
import Link from 'next/link';
import type { ServiceHealthStatus } from '@/lib/monitoring/types';

export const metadata: Metadata = {
  title: 'System Health | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function SystemHealthPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'HealthCheck')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const providers = await getProviderHealthStatus();
  const canManage = ability.can('manage', 'HealthCheck');

  // Compute overall from provider statuses
  let overall: ServiceHealthStatus = 'HEALTHY';
  for (const p of providers) {
    if (p.status === 'UNHEALTHY') { overall = 'UNHEALTHY'; break; }
    if (p.status === 'DEGRADED') { overall = 'DEGRADED'; }
  }
  if (providers.length === 0) overall = 'UNKNOWN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">System Health</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of all service dependencies and provider health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManage && <RunChecksButton />}
          <Link
            href="/health/doctor"
            className="text-sm text-primary hover:underline"
          >
            Doctor Details
          </Link>
        </div>
      </div>

      <HealthStatusBanner status={overall} />

      {providers.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-primary">Provider Instances</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <HealthStatusCard
                key={p.instanceId}
                name={`${p.displayName} (${p.instanceName})`}
                status={(p.status as ServiceHealthStatus) ?? 'UNKNOWN'}
                latencyMs={p.latencyMs}
                lastCheckAt={p.lastCheckAt}
                error={p.error}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 py-4">
          No provider instances configured. Run doctor checks for app-level health.
        </p>
      )}
    </div>
  );
}
