'use client';

import { useState, useTransition } from 'react';
import {
  assignCustomRoleAction,
  revokeCustomRoleAction,
} from '@/lib/actions/admin-custom-roles-assign';

interface AvailableStaffItem {
  id: string;
  email: string;
  displayName: string;
}

interface AssignedStaffItem {
  id: string;
  email: string;
  displayName: string;
}

interface CustomRoleStaffListProps {
  customRoleId: string;
  assignedStaff: AssignedStaffItem[];
  canManage: boolean;
  availableStaff: AvailableStaffItem[];
}

export function CustomRoleStaffList({
  customRoleId,
  assignedStaff,
  canManage,
  availableStaff,
}: CustomRoleStaffListProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleRevoke(staffUserId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeCustomRoleAction({ staffUserId, customRoleId });
      if ('error' in result) setError(result.error ?? 'An error occurred');
    });
  }

  function handleAssign() {
    if (!selectedStaffId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignCustomRoleAction({
        staffUserId: selectedStaffId,
        customRoleId,
      });
      if ('error' in result) {
        setError(result.error ?? 'An error occurred');
      } else {
        setSelectedStaffId('');
      }
    });
  }

  return (
    <div className="space-y-4">
      {assignedStaff.length === 0 ? (
        <p className="text-sm text-gray-400">No staff assigned to this role.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {assignedStaff.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{s.displayName}</p>
                <p className="text-xs text-gray-500">{s.email}</p>
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRevoke(s.id)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600
                             hover:bg-red-50 disabled:opacity-50"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && availableStaff.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                       focus:border-purple-500 focus:outline-none"
          >
            <option value="">Select staff to assign…</option>
            {availableStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !selectedStaffId}
            onClick={handleAssign}
            className="rounded-md bg-purple-600 px-3 py-2 text-sm text-white
                       hover:bg-purple-700 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      )}

      {canManage && availableStaff.length === 0 && assignedStaff.length > 0 && (
        <p className="text-xs text-gray-400">All active staff are already assigned to this role.</p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
