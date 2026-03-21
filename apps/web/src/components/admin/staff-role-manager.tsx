'use client';

/**
 * StaffRoleManager — Client component for grant/revoke system roles (A4)
 */

import { useTransition, useState } from 'react';
import { grantSystemRoleAction, revokeSystemRoleAction } from '@/lib/actions/admin-staff';
import type { PlatformRole } from '@twicely/casl/types';

const ALL_ROLES: PlatformRole[] = [
  'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
  'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN',
];

const ELEVATED_ROLES: PlatformRole[] = ['ADMIN', 'SUPER_ADMIN'];

interface ActiveRole {
  id: string;
  role: PlatformRole;
  grantedByStaffId: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

interface StaffRoleManagerProps {
  staffUserId: string;
  activeRoles: ActiveRole[];
  revokedRoles: ActiveRole[];
  viewerRoles: PlatformRole[];
  isSelf: boolean;
}

export function StaffRoleManager({
  staffUserId,
  activeRoles,
  revokedRoles,
  viewerRoles,
  isSelf,
}: StaffRoleManagerProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlatformRole | ''>('');
  const [showHistory, setShowHistory] = useState(false);

  const isSuperAdmin = viewerRoles.includes('SUPER_ADMIN');
  const isTargetSuperAdmin = activeRoles.some((r) => r.role === 'SUPER_ADMIN');
  const readOnly = isSelf || (!isSuperAdmin && isTargetSuperAdmin);

  const activeRoleValues = activeRoles.map((r) => r.role);
  const grantableRoles = ALL_ROLES.filter((r) => {
    if (activeRoleValues.includes(r)) return false;
    if (!isSuperAdmin && ELEVATED_ROLES.includes(r)) return false;
    return true;
  });

  function handleGrant() {
    if (!selectedRole) return;
    startTransition(async () => {
      const res = await grantSystemRoleAction({ staffUserId, role: selectedRole });
      setMessage(res.error ?? 'Role granted');
      setSelectedRole('');
    });
  }

  function handleRevoke(role: PlatformRole) {
    startTransition(async () => {
      const res = await revokeSystemRoleAction({ staffUserId, role });
      setMessage(res.error ?? `${role} revoked`);
    });
  }

  function canRevokeRole(role: PlatformRole): boolean {
    if (readOnly) return false;
    if (!isSuperAdmin && ELEVATED_ROLES.includes(role)) return false;
    return true;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">System Roles</h3>

      <div className="flex flex-wrap gap-2">
        {activeRoles.map((r) => (
          <div key={r.id} className="flex items-center gap-1">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {r.role}
            </span>
            {canRevokeRole(r.role) && (
              <button
                onClick={() => handleRevoke(r.role)}
                disabled={pending}
                className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
        {activeRoles.length === 0 && (
          <span className="text-xs text-gray-400">No active roles</span>
        )}
      </div>

      {!readOnly && grantableRoles.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as PlatformRole | '')}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            disabled={pending}
          >
            <option value="">Select role to grant...</option>
            {grantableRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            onClick={handleGrant}
            disabled={pending || !selectedRole}
            className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Grant
          </button>
        </div>
      )}

      {message && <p className="text-xs text-gray-500">{message}</p>}

      {revokedRoles.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {showHistory ? 'Hide' : 'Show'} role history ({revokedRoles.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1">
              {revokedRoles.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5">{r.role}</span>
                  <span>revoked {r.revokedAt?.toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
