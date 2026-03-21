import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getFeatureFlagById } from '@/lib/queries/admin-feature-flags';
import { getAuditEventsForSubject } from '@/lib/queries/admin-audit-events';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@twicely/ui/badge';

export const metadata: Metadata = {
  title: 'Feature Flag Detail | Twicely Hub',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

const SEVERITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  LOW: 'secondary',
  MEDIUM: 'outline',
  HIGH: 'default',
  CRITICAL: 'destructive',
};

export default async function FeatureFlagDetailPage({ params }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'FeatureFlag')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const [flag, history] = await Promise.all([
    getFeatureFlagById(id),
    getAuditEventsForSubject('FeatureFlag', id, 20),
  ]);

  if (!flag) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/flags" className="hover:text-gray-700">
          Feature Flags
        </Link>
        <span>/</span>
        <span className="text-gray-900">{flag.key}</span>
      </div>

      <AdminPageHeader
        title={flag.name}
        description={flag.description ?? flag.key}
      />

      {/* ── Flag metadata ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Flag Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Key</dt>
            <dd className="font-mono text-gray-900">{flag.key}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Type</dt>
            <dd className="font-medium text-gray-900">{flag.type}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Enabled</dt>
            <dd>
              <Badge variant={flag.enabled ? 'default' : 'secondary'}>
                {flag.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </dd>
          </div>
          {flag.percentage !== null && (
            <div>
              <dt className="text-gray-500">Rollout %</dt>
              <dd className="font-medium text-gray-900">{flag.percentage}%</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="font-medium text-gray-900">
              {new Date(flag.createdAt).toLocaleString('en-US')}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Updated</dt>
            <dd className="font-medium text-gray-900">
              {new Date(flag.updatedAt).toLocaleString('en-US')}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Audit history ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Audit History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No audit events recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">When</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {history.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(event.createdAt).toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-800">
                      {event.action}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {event.actorId ?? event.actorType}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          SEVERITY_VARIANT[event.severity] ?? 'secondary'
                        }
                      >
                        {event.severity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
