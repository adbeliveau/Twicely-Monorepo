import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getCustomRoleById, getStaffForCustomRoleAssignment } from '@/lib/queries/admin-staff';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CustomRoleForm } from '@/components/admin/custom-role-form';
import { CustomRoleStaffList } from '@/components/admin/custom-role-staff-list';
import { PermissionToggleGrid } from '@/components/admin/permission-toggle-grid';
import { DeleteCustomRoleButton } from '@/components/admin/actions/delete-custom-role-button';

export const metadata: Metadata = { title: 'Edit Role | Twicely Hub' };

export default async function CustomRoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('read', 'CustomRole')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const roleDetail = await getCustomRoleById(id);
  if (!roleDetail) notFound();

  const isSuperAdmin = session.platformRoles.includes('SUPER_ADMIN');

  // Parse permissionsJson into typed array
  const permissions = Array.isArray(roleDetail.permissionsJson)
    ? (roleDetail.permissionsJson as Array<{ subject: string; action: string }>)
    : [];

  // Load available staff for assignment dropdown (SUPER_ADMIN only)
  const availableStaff = isSuperAdmin
    ? await getStaffForCustomRoleAssignment(id)
    : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={roleDetail.name}
        description={roleDetail.code}
        actions={
          <Link
            href="/roles"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Roles
          </Link>
        }
      />

      {/* Form section: edit (SUPER_ADMIN) or read-only view */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {isSuperAdmin ? (
          <CustomRoleForm
            mode="edit"
            initialData={{
              id: roleDetail.id,
              name: roleDetail.name,
              code: roleDetail.code,
              description: roleDetail.description,
              permissions,
            }}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Display Name</p>
              <p className="mt-1 text-sm text-gray-900">{roleDetail.name}</p>
            </div>
            {roleDetail.description && (
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Description</p>
                <p className="mt-1 text-sm text-gray-600">{roleDetail.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-3">Permissions</p>
              <PermissionToggleGrid
                permissions={permissions}
                onChange={() => undefined}
                readOnly={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Assigned Staff */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-primary">
          Assigned Staff
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            {roleDetail.assignedStaff.length}
          </span>
        </h2>
        <CustomRoleStaffList
          customRoleId={id}
          assignedStaff={roleDetail.assignedStaff}
          canManage={isSuperAdmin}
          availableStaff={availableStaff}
        />
      </div>

      {/* Delete Role (SUPER_ADMIN only) */}
      {isSuperAdmin && (
        <div className="rounded-lg border border-red-200 bg-white p-6 space-y-3">
          <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
          <p className="text-sm text-gray-600">
            Deleting this role will remove it from all{' '}
            <span className="font-semibold">{roleDetail.assignedStaff.length}</span> assigned staff
            members. This action cannot be undone.
          </p>
          <DeleteCustomRoleButton
            customRoleId={id}
            roleName={roleDetail.name}
            affectedCount={roleDetail.assignedStaff.length}
          />
        </div>
      )}
    </div>
  );
}
