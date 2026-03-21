import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getRetentionDashboard,
  getDeletionQueue,
  getDataExportRequests,
  getGdprComplianceSummary,
  getRetentionJobStatus,
} from '@/lib/actions/admin-data-retention';
import { RetentionDashboard } from '@/components/pages/data-retention/retention-dashboard';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Data Retention | Twicely Hub',
};

export default async function DataRetentionPage() {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataRetention')) {
    return <p className="p-6 text-destructive">Access denied</p>;
  }

  const [{ policies }, deletionQueue, exportRequests, gdprSummary, jobStatus] = await Promise.all([
    getRetentionDashboard(),
    getDeletionQueue(),
    getDataExportRequests(),
    getGdprComplianceSummary(),
    getRetentionJobStatus(),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Data Retention"
        description="GDPR compliance, deletion queue, and data export requests"
      />
      <div className="flex gap-2 border-b mb-6">
        <Link
          href="/cfg/data-retention"
          className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary"
        >
          Overview
        </Link>
        <Link
          href="/cfg/data-retention/exports"
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
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
      <RetentionDashboard
        policies={policies}
        deletionQueue={deletionQueue}
        exportRequests={exportRequests}
        gdprSummary={gdprSummary}
        jobStatus={jobStatus}
      />
    </div>
  );
}
