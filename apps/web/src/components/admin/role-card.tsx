/**
 * RoleCard — Card component for the roles grid on /roles.
 * Displays role name, system/locked badges, description, permission count,
 * updated date, two module access rows, and an Edit Role button.
 */

import Link from 'next/link';

export interface RoleCardData {
  id: string;
  /** Human-readable display name, e.g. "Finance Admin" */
  displayName: string;
  /** Internal code, e.g. "FINANCE_ADMIN" or "FINANCE" */
  code: string;
  description: string;
  /** True for built-in system roles */
  isSystem: boolean;
  /** True only for SUPER_ADMIN — disables the Edit Role button */
  isLocked: boolean;
  /** Permission count label, e.g. "16 permissions enabled" or "Full access (wildcard)" */
  permissionSummary: string;
  /** Last updated date string, e.g. "Feb 7, 2026" */
  updatedAt: string;
  /** Access level string for Platform Team module */
  platformTeamAccess: string;
  /** Access level string for Business Accounts module */
  businessAccountsAccess: string;
  /** href for the Edit Role link */
  editHref: string;
}

export function RoleCard({
  displayName,
  description,
  isSystem,
  isLocked,
  permissionSummary,
  updatedAt,
  platformTeamAccess,
  businessAccountsAccess,
  editHref,
}: RoleCardData) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-5">
      {/* Header: name + badges */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{displayName}</h3>
        <div className="flex flex-shrink-0 gap-1.5">
          {isSystem && (
            <span className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600">
              System
            </span>
          )}
          {isLocked && (
            <span className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600">
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-gray-500">{description}</p>

      {/* Permission count + Updated date */}
      <div className="mb-4 flex items-center justify-between text-xs text-gray-400">
        <span>{permissionSummary}</span>
        <span>Updated {updatedAt}</span>
      </div>

      {/* Divider */}
      <hr className="mb-4 border-gray-100" />

      {/* Module access rows */}
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Platform Team</span>
          <span className="text-gray-500">{platformTeamAccess}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Business Accounts</span>
          <span className="text-gray-500">{businessAccountsAccess}</span>
        </div>
      </div>

      {/* Edit / View Role button — pushes to bottom */}
      <div className="mt-auto">
        {isLocked ? (
          <Link
            href={editHref}
            className="block w-full rounded-md border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View Role
          </Link>
        ) : (
          <Link
            href={editHref}
            className="block w-full rounded-md border border-gray-300 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Edit Role
          </Link>
        )}
      </div>
    </div>
  );
}
