'use client';

import { LogOut } from 'lucide-react';
import { logoutStaffAction } from '@/lib/actions/staff-login';
import type { PlatformRole } from '@twicely/casl/types';

interface AdminTopbarProps {
  displayName: string;
  roles: PlatformRole[];
}

function RoleBadge({ role }: { role: PlatformRole }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      {role.replace(/_/g, ' ')}
    </span>
  );
}

export function AdminTopbar({ displayName, roles }: AdminTopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left: breadcrumb placeholder */}
      <div className="flex items-center gap-2" />

      {/* Right: staff info + logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {roles.slice(0, 2).map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
          {roles.length > 2 && (
            <span className="text-xs text-gray-400">
              +{roles.length - 2}
            </span>
          )}
        </div>

        <span className="text-sm font-semibold text-gray-900">{displayName}</span>

        <form action={logoutStaffAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
