import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getHighSeverityAuditEvents } from '@/lib/queries/admin-audit-events';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@twicely/ui/badge';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Error Log | Twicely Hub',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{
    page?: string;
    severity?: string;
    subject?: string;
  }>;
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

function truncate(str: unknown, maxLen: number): string {
  const s = typeof str === 'string' ? str : JSON.stringify(str) ?? '';
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

export default async function ErrorLogPage({ searchParams }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'AuditEvent')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const severity =
    sp.severity === 'HIGH' || sp.severity === 'CRITICAL' ? sp.severity : undefined;
  const subject = sp.subject?.trim() || undefined;

  const { events, total } = await getHighSeverityAuditEvents({
    severity,
    subject,
    page,
    pageSize: 25,
  });

  const totalPages = Math.max(1, Math.ceil(total / 25));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  function buildPageHref(p: number): string {
    const q = new URLSearchParams();
    q.set('page', String(p));
    if (severity) q.set('severity', severity);
    if (subject) q.set('subject', subject);
    return `/errors?${q.toString()}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Error Log"
        description="High and critical severity audit events."
      />

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <form method="GET" action="/errors" className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label htmlFor="severity-filter" className="text-xs font-medium text-gray-600">
            Severity
          </label>
          <select
            id="severity-filter"
            name="severity"
            defaultValue={severity ?? ''}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">All high+critical</option>
            <option value="HIGH">HIGH only</option>
            <option value="CRITICAL">CRITICAL only</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="subject-filter" className="text-xs font-medium text-gray-600">
            Subject
          </label>
          <input
            id="subject-filter"
            name="subject"
            type="text"
            placeholder="e.g. FeatureFlag"
            defaultValue={subject ?? ''}
            className="rounded border border-gray-300 px-2 py-1 text-sm w-44"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-primary px-3 py-1 text-sm text-white hover:bg-primary/90"
        >
          Filter
        </button>
        {(severity || subject) && (
          <Link href="/errors" className="text-sm text-gray-500 hover:text-gray-700 underline">
            Clear
          </Link>
        )}
      </form>

      {/* ── Events table ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm text-gray-500">{total} event{total !== 1 ? 's' : ''}</p>

        {events.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No error events found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">When</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Subject ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Actor</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={SEVERITY_VARIANT[event.severity] ?? 'secondary'}>
                        {event.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-800">
                      {event.action}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{event.subject}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">
                      {event.subjectId ? truncate(event.subjectId, 16) : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {event.actorId ? truncate(event.actorId, 16) : event.actorType}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500 max-w-xs truncate">
                      {truncate(event.detailsJson, 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {prevPage !== null ? (
            <Link href={buildPageHref(prevPage)} className="text-primary hover:underline">
              Previous
            </Link>
          ) : (
            <span className="text-gray-300">Previous</span>
          )}
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          {nextPage !== null ? (
            <Link href={buildPageHref(nextPage)} className="text-primary hover:underline">
              Next
            </Link>
          ) : (
            <span className="text-gray-300">Next</span>
          )}
        </div>
      )}
    </div>
  );
}
