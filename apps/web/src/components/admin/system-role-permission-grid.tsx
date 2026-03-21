/**
 * SystemRolePermissionGrid — Read-only permission toggle grid for system roles.
 * Matches V2's role edit page layout (module name + description + action toggles).
 * Server component — no 'use client' needed since everything is read-only.
 */

import {
  PERMISSION_MODULES,
  type PermissionModule,
} from '@/lib/casl/permission-registry';

interface Props {
  /** The permission pairs this role grants */
  permissions: Array<{ subject: string; action: string }>;
}

const ACTION_LABELS: Record<string, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  manage: 'Manage',
  moderate: 'Moderate',
  execute: 'Execute',
  impersonate: 'Impersonate',
  warn: 'Warn',
  restrict: 'Restrict',
  message: 'Message',
};

function isEnabled(
  permissions: Array<{ subject: string; action: string }>,
  subject: string,
  action: string
): boolean {
  return permissions.some((p) => p.subject === subject && p.action === action);
}

function ReadOnlyToggle({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent opacity-70 ${
        enabled ? 'bg-purple-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </div>
  );
}

function ModuleRow({ mod, permissions }: { mod: PermissionModule; permissions: Props['permissions'] }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900">{mod.name}</h3>
          <p className="text-sm text-purple-600">{mod.description}</p>
        </div>
        <div className="ml-4 flex items-center gap-6">
          {mod.actions.map((a) => (
            <div key={a.action} className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">{ACTION_LABELS[a.action] ?? a.action}</span>
              <ReadOnlyToggle enabled={isEnabled(permissions, mod.subject, a.action)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SystemRolePermissionGrid({ permissions }: Props) {
  return (
    <div className="divide-y divide-gray-200">
      {PERMISSION_MODULES.map((mod) => (
        <ModuleRow key={mod.subject} mod={mod} permissions={permissions} />
      ))}
    </div>
  );
}
