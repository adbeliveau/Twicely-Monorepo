/**
 * GDPR Compliance Summary Card & Retention Job Status Card — G8.4
 *
 * Two new cards added to the admin /data-retention dashboard.
 * Displays compliance counts and last-run status for cleanup cron jobs.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import type {
  GdprComplianceSummary,
  RetentionJobStatus,
} from '@/lib/actions/admin-data-retention';

interface GdprComplianceCardProps {
  summary: GdprComplianceSummary;
}

/**
 * Shows GDPR compliance counts: active deletion requests, pending/completed
 * exports, and failed exports requiring attention.
 */
export function GdprComplianceCard({ summary }: GdprComplianceCardProps) {
  const items = [
    {
      label: 'Active deletion requests (in cooling-off)',
      value: summary.activeDeletionRequests,
      highlight: summary.activeDeletionRequests > 0,
    },
    {
      label: 'Completed deletions (last 30 days)',
      value: summary.completedDeletionsLast30Days,
      highlight: false,
    },
    {
      label: 'Pending data exports',
      value: summary.pendingDataExports,
      highlight: summary.pendingDataExports > 0,
    },
    {
      label: 'Completed exports (last 30 days)',
      value: summary.completedExportsLast30Days,
      highlight: false,
    },
    {
      label: 'Failed exports requiring attention',
      value: summary.failedExportsRequiringAttention,
      highlight: summary.failedExportsRequiringAttention > 0,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>GDPR Compliance Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between py-2">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd
                className={
                  item.highlight
                    ? 'text-sm font-semibold text-destructive'
                    : 'text-sm font-semibold'
                }
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

interface RetentionJobStatusCardProps {
  status: RetentionJobStatus;
}

function formatJobDate(iso: string | null): string {
  if (!iso) return 'Never run';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Shows last-run timestamps and result summaries for each cleanup cron job.
 */
export function RetentionJobStatusCard({ status }: RetentionJobStatusCardProps) {
  const jobs = [
    {
      label: 'Session Cleanup',
      schedule: 'Every 6 hours',
      lastRunAt: status.sessionCleanup.lastRunAt,
      lastResult: status.sessionCleanup.lastResult,
    },
    {
      label: 'Audit Archive',
      schedule: 'Monthly (1st at 03:00 UTC)',
      lastRunAt: status.auditArchive.lastRunAt,
      lastResult: status.auditArchive.lastResult,
    },
    {
      label: 'Data Purge',
      schedule: 'Daily at 04:30 UTC',
      lastRunAt: status.dataPurge.lastRunAt,
      lastResult: status.dataPurge.lastResult,
    },
    {
      label: 'Account Deletion Executor',
      schedule: 'Daily at 04:00 UTC',
      lastRunAt: status.accountDeletion.lastRunAt,
      lastResult: status.accountDeletion.lastResult,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention Job Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{job.label}</p>
                <span className="text-xs text-muted-foreground">{job.schedule}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Last run: {formatJobDate(job.lastRunAt)}
              </p>
              {job.lastResult && (
                <p className="truncate text-xs text-muted-foreground">
                  Result: {job.lastResult}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
