import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAuditEvents } from '@/lib/queries/admin-audit-log';
import { auditLogQuerySchema } from '@/lib/queries/admin-audit-log-schemas';
import { AuditLogTable } from '@/components/admin/audit-log-table';
import { AuditLogFilters } from '@/components/admin/audit-log-filters';

export const metadata: Metadata = {
  title: 'Audit Log | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'AuditEvent')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const rawParams = await searchParams;
  const parsed = auditLogQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : { page: 1, limit: 50 };

  const { events, totalCount } = await getAuditEvents(query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Immutable record of all platform actions.
        </p>
      </div>
      <AuditLogFilters currentFilters={query} />
      <AuditLogTable
        events={events}
        totalCount={totalCount}
        page={query.page}
        limit={query.limit}
      />
    </div>
  );
}
