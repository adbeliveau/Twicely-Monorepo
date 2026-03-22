import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getStaffList } from '@/lib/queries/admin-staff';
import { StaffAvatar } from '@/components/admin/staff-avatar';
import type { PlatformRole } from '@twicely/casl/types';

export const metadata: Metadata = { title: 'Employees | Twicely Hub' };

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
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      Inactive
    </span>
  );
}

export default async function StaffListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'StaffUser')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const search = params.search ?? '';
  const statusFilter = params.status ?? 'all';
  const activeOnly = statusFilter === 'active' ? true : undefined;
  const canManage = ability.can('create', 'StaffUser');

  const { staff, total } = await getStaffList({
    page,
    pageSize: 50,
    search: search || undefined,
    activeOnly,
  });

  const totalPages = Math.ceil(total / 50);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Employees</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage Twicely platform staff and their roles
          </p>
        </div>
        {canManage && (
          <Link
            href="/roles/staff/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Employee
          </Link>
        )}
      </div>

      {/* Filters */}
      <form
        method="get"
        className="mb-6 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 gap-2">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by name or email..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Search
          </button>
        </div>
        <select
          name="status"
          defaultValue={statusFilter}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </form>

      {/* Employees Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-primary/5">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-primary/70">
                Employee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-primary/70">
                Roles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-primary/70">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-primary/70">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-primary/70">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No employees found
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link href={`/roles/staff/${s.id}`} className="flex items-center">
                      <StaffAvatar displayName={s.displayName} size="md" />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-purple-600 hover:underline">
                          {s.displayName}
                        </div>
                        <div className="text-sm text-gray-500">{s.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {s.roles.length > 0 ? (
                        [...new Set(s.roles)].map((role) => (
                          <span
                            key={role}
                            className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                          >
                            {ROLE_LABELS[role] ?? role}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No roles</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge isActive={s.isActive} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(s.lastLoginAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {formatDate(s.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary + Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Showing {staff.length} employee{staff.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/roles/staff?page=${page - 1}&search=${search}&status=${statusFilter}`}
                className="rounded border px-3 py-1 hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            <span className="px-3 py-1">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/roles/staff?page=${page + 1}&search=${search}&status=${statusFilter}`}
                className="rounded border px-3 py-1 hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
