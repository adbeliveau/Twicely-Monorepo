import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CustomRoleForm } from '@/components/admin/custom-role-form';

export const metadata: Metadata = { title: 'Create Role | Twicely Hub' };

export default async function CreateCustomRolePage() {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'CustomRole')) {
    return <p className="text-red-600">Access denied</p>;
  }

  if (!session.platformRoles.includes('SUPER_ADMIN')) {
    return <p className="text-red-600">Only SUPER_ADMIN can create custom roles</p>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Create Role"
        description="Define a new custom permission set for hub staff"
        actions={
          <Link
            href="/roles"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Roles
          </Link>
        }
      />
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <CustomRoleForm mode="create" />
      </div>
    </div>
  );
}
