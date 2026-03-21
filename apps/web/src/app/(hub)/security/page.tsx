// NAV_ENTRY: { label: 'Security', href: '/security', icon: 'Shield', roles: ['ADMIN', 'SRE'] }

import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSecurityEvents, getSecurityEventKPIs } from '@/lib/queries/admin-trust-security';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { Shield, AlertCircle, Clock, Calendar } from 'lucide-react';

export const metadata: Metadata = { title: 'Security Events | Twicely Hub' };

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-gray-100 text-gray-600',
};

/** Security event types per Actors/Security Section 13.1 */
const EVENT_DEFINITIONS = [
  { action: 'security.login.failed', description: 'Failed login attempt' },
  { action: 'security.session.revoked', description: 'Active session forcibly revoked' },
  { action: 'security.2fa.setup', description: 'Two-factor authentication enabled' },
  { action: 'security.2fa.removed', description: 'Two-factor authentication removed' },
  { action: 'security.payout_destination.changed', description: 'Payout bank account or destination changed' },
  { action: 'security.password.changed', description: 'Account password changed' },
  { action: 'security.email.changed', description: 'Account email address changed' },
  { action: 'security.fraud.flagged', description: 'Account or transaction flagged for fraud' },
  { action: 'security.incident.created', description: 'Security incident created for investigation' },
];

interface PageProps {
  searchParams: Promise<{ page?: string; severity?: string; action?: string }>;
}

export default async function SecurityPage({ searchParams }: PageProps) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'AuditEvent')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const severityFilter = sp.severity ?? '';
  const actionFilter = sp.action ?? '';
  const pageSize = 20;

  const [kpis, { events, total }] = await Promise.all([
    getSecurityEventKPIs(),
    getSecurityEvents({ page, pageSize, severity: severityFilter || undefined, action: actionFilter || undefined }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const criticalCount = kpis.bySeverity.find((s) => s.severity === 'CRITICAL')?.count ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Security Events"
        description="Authentication audit, security alerts, and incident monitoring"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Events (Last 24h)" value={kpis.last24h} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Events (Last 7d)" value={kpis.last7d} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Events (Last 30d)" value={kpis.last30d} icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Critical Events" value={criticalCount} icon={<AlertCircle className="h-4 w-4" />} color="error" />
      </div>

      {/* Severity Breakdown */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Severity Breakdown (Last 30 Days)</h2>
        <div className="flex gap-3">
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
            const entry = kpis.bySeverity.find((s) => s.severity === sev);
            return (
              <div key={sev} className={`rounded-lg px-4 py-3 text-center ${SEVERITY_COLORS[sev] ?? 'bg-gray-100 text-gray-600'}`}>
                <p className="text-xs font-medium">{sev}</p>
                <p className="text-xl font-bold">{entry?.count ?? 0}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Event Types */}
      {kpis.topEventTypes.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Top Event Types (Last 30 Days)</h2>
          <div className="rounded-lg border border-gray-200 bg-white">
            {kpis.topEventTypes.map((t) => (
              <div key={t.action} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0">
                <span className="font-mono text-sm text-gray-700">{t.action}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <form className="flex flex-wrap gap-3">
        <select name="severity" defaultValue={severityFilter} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All severities</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="action" defaultValue={actionFilter} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All event types</option>
          {EVENT_DEFINITIONS.map((e) => <option key={e.action} value={e.action}>{e.action}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">Filter</button>
      </form>

      {/* Events Table */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Security Events ({total} total)</h2>
          <span className="text-xs text-gray-400">Page {page} of {totalPages || 1}</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Time', 'Severity', 'Action', 'Subject', 'Actor', 'IP Address'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {events.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-gray-400">No security events found</td></tr>
              ) : events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{e.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[e.severity] ?? 'bg-gray-100 text-gray-600'}`}>{e.severity}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-3 text-gray-600">{e.subject}{e.subjectId ? ` (${e.subjectId.slice(0, 8)})` : ''}</td>
                  <td className="px-4 py-3 text-gray-600">{e.actorType}{e.actorId ? ` (${e.actorId.slice(0, 8)})` : ''}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}&severity=${severityFilter}&action=${actionFilter}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Previous</a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}&severity=${severityFilter}&action=${actionFilter}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Next</a>
            )}
          </div>
        )}
      </div>

      {/* Reference Panel */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Security Event Definitions (Reference)</h2>
        <div className="rounded-lg border border-gray-200 bg-white">
          {EVENT_DEFINITIONS.map((e) => (
            <div key={e.action} className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
              <span className="font-mono text-xs text-gray-600">{e.action}</span>
              <span className="text-xs text-gray-500">{e.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
