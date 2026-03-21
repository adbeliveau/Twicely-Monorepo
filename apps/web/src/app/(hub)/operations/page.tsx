import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getOperationsSummary } from '@/lib/queries/admin-operations';
import { getHighSeverityAuditEvents } from '@/lib/queries/admin-audit-events';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@twicely/ui/badge';

export const metadata: Metadata = {
  title: 'Platform Operations | Twicely Hub',
  robots: { index: false, follow: false },
};

const SEVERITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  LOW: 'secondary',
  MEDIUM: 'outline',
  HIGH: 'default',
  CRITICAL: 'destructive',
};

export default async function PlatformOperationsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'HealthCheck')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [summary, { events: recentCritical }] = await Promise.all([
    getOperationsSummary(),
    getHighSeverityAuditEvents({ severity: 'CRITICAL', page: 1, pageSize: 10 }),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Platform Operations"
        description="Live summary of platform health, flags, and recent critical events."
      />

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Providers</p>
          <p className="text-2xl font-bold text-primary">{summary.providerCounts.total}</p>
          <p className="text-xs text-gray-500">
            {summary.providerCounts.active} active / {summary.providerCounts.inactive} inactive
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Kill Switches Active</p>
          <p className="text-2xl font-bold text-red-600">{summary.killSwitchActive}</p>
          <p className="text-xs text-gray-500">of {summary.totalFlags} total flags</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Critical Events 24h</p>
          <p
            className={
              summary.criticalEvents24h > 0
                ? 'text-2xl font-bold text-red-600'
                : 'text-2xl font-bold text-green-600'
            }
          >
            {summary.criticalEvents24h}
          </p>
          <p className="text-xs text-gray-500">severity CRITICAL</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Flags Enabled</p>
          <p className="text-2xl font-bold text-primary">{summary.enabledFlags}</p>
          <p className="text-xs text-gray-500">of {summary.totalFlags} total</p>
        </div>
      </div>

      {/* ── Recent critical events ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Recent Critical Events</h2>
        {recentCritical.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No critical events recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">When</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentCritical.map((ev) => (
                  <tr key={ev.id}>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={SEVERITY_VARIANT[ev.severity] ?? 'secondary'}>
                        {ev.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-800">{ev.action}</td>
                    <td className="px-4 py-2 text-gray-700">{ev.subject}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {ev.actorId ?? ev.actorType}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Quick Links</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/health"
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            System Health
          </Link>
          <Link
            href="/flags"
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            Feature Flags
          </Link>
          <Link
            href="/audit"
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            Audit Log
          </Link>
          <Link
            href="/health/doctor"
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            Doctor
          </Link>
        </div>
      </div>
    </div>
  );
}
