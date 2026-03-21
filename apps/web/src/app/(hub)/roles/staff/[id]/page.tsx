import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getStaffById, getCustomRoleList } from '@/lib/queries/admin-staff';
import { StaffRoleManager } from '@/components/admin/staff-role-manager';
import { StaffActions } from '@/components/admin/actions/staff-actions';
import { StaffCustomRoleManager } from '@/components/admin/staff-custom-role-manager';
import { StaffAvatar } from '@/components/admin/staff-avatar';
import type { PlatformRole } from '@twicely/casl/types';

export const metadata: Metadata = { title: 'Employee Detail | Twicely Hub' };

const ROLE_LABELS: Record<PlatformRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Platform Admin',
  MODERATION: 'Content Moderator',
  DEVELOPER: 'Developer',
  FINANCE: 'Finance Admin',
  HELPDESK_AGENT: 'Helpdesk Agent',
  HELPDESK_LEAD: 'Helpdesk Lead',
  HELPDESK_MANAGER: 'Helpdesk Manager',
  SRE: 'SRE',
  SUPPORT: 'Support Agent',
};

function formatDate(date: Date | null): string {
  if (!date) return 'Never';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function splitName(displayName: string): { firstName: string; lastName: string } {
  const idx = displayName.indexOf(' ');
  if (idx === -1) return { firstName: displayName, lastName: '---' };
  return { firstName: displayName.slice(0, idx), lastName: displayName.slice(idx + 1) };
}

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('read', 'StaffUser')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const staffDetail = await getStaffById(id);
  if (!staffDetail) notFound();

  const canManage = ability.can('update', 'StaffUser');
  const isSelf = session.staffUserId === id;
  const isSuperAdmin = session.platformRoles.includes('SUPER_ADMIN');
  const isTerminated = !staffDetail.isActive;

  const activeRoles = staffDetail.systemRoles.filter((r) => r.revokedAt === null);
  const revokedRoles = staffDetail.systemRoles.filter((r) => r.revokedAt !== null);

  const activeRolesForManager = activeRoles.map((r) => ({
    id: r.id, role: r.role as PlatformRole,
    grantedByStaffId: r.grantedByStaffId, grantedAt: r.grantedAt, revokedAt: r.revokedAt,
  }));
  const revokedRolesForManager = revokedRoles.map((r) => ({
    id: r.id, role: r.role as PlatformRole,
    grantedByStaffId: r.grantedByStaffId, grantedAt: r.grantedAt, revokedAt: r.revokedAt,
  }));

  const allCustomRoles = isSuperAdmin ? await getCustomRoleList() : [];
  const activeCustomRoleIds = new Set(
    staffDetail.customRoles.filter((r) => r.revokedAt === null).map((r) => r.customRoleId)
  );
  const availableCustomRoles = allCustomRoles.filter((r) => !activeCustomRoleIds.has(r.id));
  const { firstName, lastName } = splitName(staffDetail.displayName);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href="/roles/staff"
        className="inline-block text-sm text-purple-600 hover:underline"
      >
        &larr; Back to Employees
      </Link>

      {/* Profile Header Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-6">
            <StaffAvatar displayName={staffDetail.displayName} size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-primary">{staffDetail.displayName}</h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    staffDetail.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {staffDetail.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{staffDetail.email}</p>
            </div>
          </div>

          {/* Action Buttons — V2 style: outlined with colored borders */}
          {canManage && !isSelf && !isTerminated && (
            <StaffActions
              staffUserId={id}
              isActive={staffDetail.isActive}
              canManage={canManage}
            />
          )}
        </div>
      </div>

      {/* Details Grid — two columns */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-primary">Personal Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">First Name</dt>
              <dd className="text-sm text-gray-900">{firstName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Name</dt>
              <dd className="text-sm text-gray-900">{lastName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">{staffDetail.email}</dd>
            </div>
          </dl>
        </div>

        {/* Account Details */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-primary">Account Details</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
              <dd className="font-mono text-sm text-gray-900">{staffDetail.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Joined</dt>
              <dd className="text-sm text-gray-900">{formatDate(staffDetail.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Login</dt>
              <dd className="text-sm text-gray-900">{formatDate(staffDetail.lastLoginAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Assigned Roles */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Assigned Roles</h2>
        </div>
        {activeRoles.length === 0 ? (
          <p className="text-sm text-gray-500">No roles assigned.</p>
        ) : (
          <div className="space-y-3">
            {activeRoles.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div>
                  <span className="font-medium text-purple-600">
                    {ROLE_LABELS[r.role as PlatformRole] ?? r.role}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">{r.role}</span>
                </div>
                <span className="text-xs text-gray-500">
                  Granted {formatDate(r.grantedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role grant/revoke manager (interactive) */}
      <StaffRoleManager
        staffUserId={id}
        activeRoles={activeRolesForManager}
        revokedRoles={revokedRolesForManager}
        viewerRoles={session.platformRoles}
        isSelf={isSelf}
      />

      {/* Custom roles manager */}
      <StaffCustomRoleManager
        staffUserId={id}
        assignedCustomRoles={staffDetail.customRoles}
        canManage={isSuperAdmin}
        availableCustomRoles={availableCustomRoles}
      />

      {/* Terminated banner */}
      {isTerminated && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            This employee has been terminated. All sessions have been revoked and all roles removed.
          </p>
        </div>
      )}
    </div>
  );
}
