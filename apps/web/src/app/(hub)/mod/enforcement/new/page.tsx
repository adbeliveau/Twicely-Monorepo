import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { IssueEnforcementForm } from '@/components/admin/actions/enforcement-actions';

export const metadata: Metadata = { title: 'Issue Enforcement Action | Twicely Hub' };

export default async function NewEnforcementActionPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; reportId?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('create', 'EnforcementAction')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Issue Enforcement Action"
        description="Take action against a user for policy violations or content reports"
      />
      <div className="max-w-2xl">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <IssueEnforcementForm
            prefillUserId={params.userId}
            prefillReportId={params.reportId}
          />
        </div>
      </div>
    </div>
  );
}
