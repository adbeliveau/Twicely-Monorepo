import Link from 'next/link';
import type { CustomRoleListItem } from '@/lib/queries/admin-staff';

interface CustomRoleListSectionProps {
  customRoles: CustomRoleListItem[];
  isSuperAdmin: boolean;
}

export function CustomRoleListSection({
  customRoles,
  isSuperAdmin,
}: CustomRoleListSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          Custom Roles
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
            {customRoles.length}
          </span>
        </h2>
        {isSuperAdmin && (
          <Link
            href="/roles/custom/new"
            className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
          >
            New Role
          </Link>
        )}
      </div>

      {customRoles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center">
          <p className="text-sm text-gray-400">No custom roles defined</p>
          {isSuperAdmin && (
            <p className="mt-1 text-xs text-gray-400">
              Create a custom role to grant granular permissions beyond system roles.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customRoles.map((role) => (
            <Link
              key={role.id}
              href={`/roles/custom/${role.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-purple-300 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{role.name}</p>
                <span className="flex-shrink-0 rounded bg-purple-100 px-1.5 py-0.5 font-mono text-xs text-purple-700">
                  {role.code}
                </span>
              </div>
              {role.description && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{role.description}</p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Created {role.createdAt.toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
