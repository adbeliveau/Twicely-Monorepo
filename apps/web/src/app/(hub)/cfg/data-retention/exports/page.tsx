import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ExportManagementTable } from '@/components/admin/export-management-table';
import {
  getExportRequestAdminSummary,
  getExportRequestAdminList,
  getExportSlaBreachCount,
} from '@/lib/queries/admin-data-retention-exports';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Data Export Requests | Twicely Hub',
};

export default async function DataRetentionExportsPage() {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataExportRequest')) {
    return <p className="p-6 text-destructive">Access denied</p>;
  }

  const slaHoursRaw = await getPlatformSetting<number>('privacy.dataExportMaxHours', 48);
  const slaHours = Number(slaHoursRaw);

  const [summary, { requests, total }, breachCount] = await Promise.all([
    getExportRequestAdminSummary(),
    getExportRequestAdminList({ page: 1, pageSize: 25 }),
    getExportSlaBreachCount(slaHours),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Data Export Requests"
        description="GDPR data portability requests from users"
      />

      <div className="flex gap-2 border-b mb-6">
        <Link
          href="/cfg/data-retention"
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Overview
        </Link>
        <Link
          href="/cfg/data-retention/exports"
          className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary"
        >
          Export Requests
        </Link>
        <Link
          href="/cfg/data-retention/anonymize"
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Anonymization
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Total</p>
          <p className="mt-1 text-2xl font-bold">{summary.total}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
          <p className="mt-1 text-2xl font-bold">{summary.pending}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Completed</p>
          <p className="mt-1 text-2xl font-bold">{summary.completed}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Failed</p>
          <p className="mt-1 text-2xl font-bold">{summary.failed}</p>
        </div>
      </div>

      <ExportManagementTable
        initialRequests={requests}
        initialTotal={total}
        slaHours={slaHours}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        SLA: {slaHours} hours. {breachCount} export{breachCount !== 1 ? 's' : ''} overdue.
      </div>
    </div>
  );
}
