import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSystemRoleDefinition } from '@/lib/casl/system-role-defaults';
import { getAllPermissionPairs } from '@/lib/casl/permission-registry';
import { SystemRolePermissionGrid } from '@/components/admin/system-role-permission-grid';

export const metadata: Metadata = { title: 'Role Details | Twicely Hub' };

export default async function SystemRoleEditPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'CustomRole')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { code } = await params;
  const roleDef = getSystemRoleDefinition(code);
  if (!roleDef) notFound();

  // Resolve permissions for the toggle grid
  const permissions: Array<{ subject: string; action: string }> =
    roleDef.permissions === 'wildcard' ? getAllPermissionPairs() : roleDef.permissions;

  const isWildcard = roleDef.permissions === 'wildcard';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Role Details Card */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {/* Header with Cancel / Save */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Role Details</h2>
            <p className="text-sm text-gray-500">
              {roleDef.isLocked ? 'This role is read-only and cannot be modified.' : 'Basic role information.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/roles"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {roleDef.isLocked ? 'Back' : 'Cancel'}
            </Link>
            {!roleDef.isLocked && (
              <button
                disabled
                className="cursor-not-allowed rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white opacity-50"
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-6">
          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Display name</label>
              <input
                type="text"
                value={roleDef.displayName}
                readOnly
                disabled={roleDef.isLocked}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Code</label>
              <input
                type="text"
                value={roleDef.code}
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={roleDef.description}
              readOnly
              disabled={roleDef.isLocked}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-500"
            />
          </div>

          {roleDef.isLocked && (
            <p className="text-sm text-orange-600">
              This role is locked and cannot be edited.
            </p>
          )}
        </div>
      </div>

      {/* Module Permissions Card */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-primary">Module Permissions</h2>
          <p className="text-sm text-gray-500">
            Toggle access per module.{' '}
            <span className="text-gray-400">
              {isWildcard ? 'Full access (wildcard)' : `${permissions.length} permissions selected`}
            </span>
          </p>
        </div>

        {/* Wildcard warning banner */}
        {isWildcard && (
          <div className="border-b border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              {roleDef.isLocked
                ? 'SUPER_ADMIN has all permissions enabled. This cannot be modified.'
                : 'This role has full access to all modules.'}
            </p>
          </div>
        )}

        {/* Toggle grid */}
        <div className="p-4">
          <SystemRolePermissionGrid permissions={permissions} />
        </div>
      </div>
    </div>
  );
}
