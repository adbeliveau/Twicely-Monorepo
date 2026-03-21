'use client';

import { useState, useTransition } from 'react';
import {
  assignCustomRoleAction,
  revokeCustomRoleAction,
} from '@/lib/actions/admin-custom-roles-assign';

interface AssignedCustomRole {
  /** staffUserCustomRole.id */
  id: string;
  customRoleId: string;
  customRoleName: string;
  customRoleCode: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

interface AvailableCustomRole {
  id: string;
  name: string;
  code: string;
}

interface StaffCustomRoleManagerProps {
  staffUserId: string;
  assignedCustomRoles: AssignedCustomRole[];
  canManage: boolean;
  availableCustomRoles: AvailableCustomRole[];
}

export function StaffCustomRoleManager({
  staffUserId,
  assignedCustomRoles,
  canManage,
  availableCustomRoles,
}: StaffCustomRoleManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeRoles = assignedCustomRoles.filter((r) => r.revokedAt === null);

  function handleRevoke(customRoleId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeCustomRoleAction({ staffUserId, customRoleId });
      if ('error' in result) setError(result.error ?? 'An error occurred');
    });
  }

  function handleAssign() {
    if (!selectedRoleId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignCustomRoleAction({
        staffUserId,
        customRoleId: selectedRoleId,
      });
      if ('error' in result) {
        setError(result.error ?? 'An error occurred');
      } else {
        setSelectedRoleId('');
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Custom Roles</h3>

      {activeRoles.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeRoles.map((r) => (
            <div key={r.id} className="flex items-center gap-1">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                {r.customRoleName}
              </span>
              {canManage && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRevoke(r.customRoleId)}
                  aria-label={`Revoke ${r.customRoleName}`}
                  className="rounded p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No custom roles assigned.</p>
      )}

      {canManage && availableCustomRoles.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                       focus:border-purple-500 focus:outline-none"
          >
            <option value="">Assign a custom role…</option>
            {availableCustomRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !selectedRoleId}
            onClick={handleAssign}
            className="rounded-md bg-purple-600 px-3 py-2 text-sm text-white
                       hover:bg-purple-700 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      )}

      {canManage && availableCustomRoles.length === 0 && (
        <p className="text-xs text-gray-400">No custom roles available to assign.</p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
