import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getEnforcementActionById } from '@/lib/queries/enforcement-actions';
import { getContentReportById } from '@/lib/queries/content-reports';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { LiftActionButton } from '@/components/admin/actions/enforcement-actions';
import { AppealReviewForm } from '@/components/admin/actions/appeal-review-form';

export const metadata: Metadata = { title: 'Enforcement Action | Twicely Hub' };

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-gray-100 text-gray-600',
    LIFTED: 'bg-green-100 text-green-700',
    APPEALED: 'bg-yellow-100 text-yellow-700',
    APPEAL_APPROVED: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default async function EnforcementActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'EnforcementAction')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const action = await getEnforcementActionById(id);
  if (!action) notFound();

  const linkedReport = action.contentReportId
    ? await getContentReportById(action.contentReportId)
    : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Enforcement Action"
        description={`${action.actionType.replace(/_/g, ' ')} — ${action.status}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-primary">Action Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd><StatusBadge status={action.status} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Action Type</dt>
              <dd className="text-gray-900 font-medium">{action.actionType.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Trigger</dt>
              <dd className="text-gray-700">{action.trigger.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">User ID</dt>
              <dd className="font-mono text-xs text-gray-700">{action.userId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Issued By</dt>
              <dd className="font-mono text-xs text-gray-700">{action.issuedByStaffId ?? 'System'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-700">{formatDate(action.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Expires</dt>
              <dd className="text-gray-700">{formatDate(action.expiresAt)}</dd>
            </div>
          </dl>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Reason</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded p-3">{action.reason}</p>
          </div>
        </div>

        <div className="space-y-4">
          {linkedReport && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-2">
              <h3 className="text-sm font-semibold text-primary">Linked Content Report</h3>
              <p className="text-xs text-gray-500">
                {linkedReport.targetType} — {linkedReport.reason.replace(/_/g, ' ')}
              </p>
              <Link
                href={`/mod/reports/${linkedReport.id}`}
                className="text-xs text-blue-600 hover:underline"
              >
                View report →
              </Link>
            </div>
          )}

          {action.liftedAt && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-2">
              <h3 className="text-sm font-semibold text-primary">Lifted</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Lifted At</dt>
                  <dd className="text-gray-700">{formatDate(action.liftedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Lifted By</dt>
                  <dd className="font-mono text-xs text-gray-700">{action.liftedByStaffId ?? '—'}</dd>
                </div>
              </dl>
              {action.liftedReason && (
                <p className="text-sm text-gray-800 bg-gray-50 rounded p-3">{action.liftedReason}</p>
              )}
            </div>
          )}

          {action.appealedAt && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-yellow-900">Appeal Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-yellow-700">Appealed At</dt>
                  <dd className="text-yellow-900">{formatDate(action.appealedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-yellow-700">Appealed By</dt>
                  <dd className="font-mono text-xs text-yellow-900">{action.appealedByUserId ?? '—'}</dd>
                </div>
              </dl>
              {action.appealNote && (
                <div>
                  <p className="text-xs font-medium text-yellow-700 mb-1">Appeal Note</p>
                  <p className="text-sm text-yellow-900 bg-yellow-100 rounded p-3">{action.appealNote}</p>
                </div>
              )}
              {Array.isArray(action.appealEvidenceUrls) && action.appealEvidenceUrls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-yellow-700 mb-1">Evidence URLs</p>
                  <ul className="space-y-1">
                    {(action.appealEvidenceUrls as string[]).map((url, i) => (
                      <li key={i}>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {action.appealResolvedAt && (
                <div className="border-t border-yellow-200 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-yellow-800">Appeal Resolution</p>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-yellow-700">Resolved At</dt>
                      <dd className="text-yellow-900">{formatDate(action.appealResolvedAt)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-yellow-700">Reviewed By</dt>
                      <dd className="font-mono text-xs text-yellow-900">{action.appealReviewedByStaffId ?? '—'}</dd>
                    </div>
                  </dl>
                  {action.appealReviewNote && (
                    <p className="text-sm text-yellow-900 bg-yellow-100 rounded p-3">{action.appealReviewNote}</p>
                  )}
                </div>
              )}
              {action.status === 'APPEALED' && ability.can('update', 'EnforcementAction') && (
                <div className="border-t border-yellow-200 pt-3">
                  <p className="text-xs font-semibold text-yellow-800 mb-3">Review Appeal</p>
                  <AppealReviewForm enforcementActionId={action.id} />
                </div>
              )}
            </div>
          )}

          {ability.can('update', 'EnforcementAction') && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-primary mb-3">Actions</h3>
              <LiftActionButton actionId={action.id} currentStatus={action.status} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
