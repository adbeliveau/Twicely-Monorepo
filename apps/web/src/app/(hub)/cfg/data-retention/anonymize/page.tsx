import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AnonymizationQueue } from '@/components/admin/anonymization-queue';
import {
  getAnonymizationQueueSummary,
  getAnonymizationQueueAdmin,
} from '@/lib/queries/admin-anonymization-queue';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anonymization Queue | Twicely Hub',
};

export default async function DataRetentionAnonymizePage() {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'DataRetention')) {
    return <p className="p-6 text-destructive">Access denied</p>;
  }

  const [summary, { queue, total }] = await Promise.all([
    getAnonymizationQueueSummary(),
    getAnonymizationQueueAdmin({ page: 1, pageSize: 25 }),
  ]);

  const canManage = ability.can('manage', 'DataRetention');

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Anonymization Queue"
        description="Users pending data deletion and anonymization"
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
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Export Requests
        </Link>
        <Link
          href="/cfg/data-retention/anonymize"
          className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary"
        >
          Anonymization
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
          <p className="mt-1 text-2xl font-bold">{summary.pendingDeletions}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Processed</p>
          <p className="mt-1 text-2xl font-bold">{summary.processed}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Total</p>
          <p className="mt-1 text-2xl font-bold">{summary.total}</p>
        </div>
      </div>

      <AnonymizationQueue
        initialQueue={queue}
        initialTotal={total}
        canManage={canManage}
      />
    </div>
  );
}
