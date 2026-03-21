import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getContentReportById, getReportsForTarget } from '@/lib/queries/content-reports';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ReportReviewActions } from '@/components/admin/actions/report-review-actions';
import { ReportTargetPreview } from '@/components/admin/report-target-preview';
import type { ContentReportTarget } from '@/lib/queries/admin-report-target';

export const metadata: Metadata = { title: 'Content Report | Twicely Hub' };

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    UNDER_REVIEW: 'bg-blue-100 text-blue-700',
    CONFIRMED: 'bg-red-100 text-red-700',
    DISMISSED: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default async function ContentReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ContentReport')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const report = await getContentReportById(id);
  if (!report) notFound();

  const targetType = report.targetType as ContentReportTarget;
  const allTargetReports = await getReportsForTarget(targetType, report.targetId);
  const otherReportsCount = allTargetReports.filter((r) => r.id !== report.id).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Content Report"
        description={`Report #${report.id.slice(0, 8)}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-primary">Report Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd><StatusBadge status={report.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Target Type</dt>
              <dd className="text-gray-900">{report.targetType}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Target ID</dt>
              <dd className="font-mono text-xs text-gray-700">{report.targetId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Reason</dt>
              <dd className="text-gray-900">{report.reason.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Reporter</dt>
              <dd className="text-right">
                {report.reporterName && (
                  <span className="block text-gray-900">{report.reporterName}</span>
                )}
                <span className="font-mono text-xs text-gray-500">({report.reporterUserId})</span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Reported</dt>
              <dd className="text-gray-700">{formatDate(report.createdAt)}</dd>
            </div>
          </dl>
          {report.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Reporter description</p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded p-3">{report.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Target Content</p>
            <ReportTargetPreview targetType={targetType} targetId={report.targetId} />
          </div>

          {otherReportsCount > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={`/mod/reports?targetType=${report.targetType}&targetId=${report.targetId}`}
                className="text-xs text-blue-600 hover:underline"
              >
                {otherReportsCount} other report{otherReportsCount !== 1 ? 's' : ''} for this target
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-primary">Review Status</h3>
          {report.reviewedAt && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Reviewed by</dt>
                <dd className="font-mono text-xs text-gray-700">{report.reviewedByStaffId ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Reviewed at</dt>
                <dd className="text-gray-700">{formatDate(report.reviewedAt)}</dd>
              </div>
            </dl>
          )}
          {report.reviewNotes && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Review notes</p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded p-3">{report.reviewNotes}</p>
            </div>
          )}
          {ability.can('update', 'ContentReport') && (
            <ReportReviewActions reportId={report.id} currentStatus={report.status} />
          )}
          {report.enforcementActionId && (
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={`/mod/enforcement/${report.enforcementActionId}`}
                className="text-xs text-blue-600 hover:underline"
              >
                View linked enforcement action
              </Link>
            </div>
          )}
          {report.status === 'CONFIRMED' && !report.enforcementActionId && (
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={`/mod/enforcement/new?userId=&reportId=${report.id}`}
                className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Issue Enforcement Action
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
