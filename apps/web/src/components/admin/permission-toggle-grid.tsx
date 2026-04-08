'use client';

import {
  PERMISSION_MODULES,
  CATEGORY_LABELS,
  getModulesByCategory,
  type PermissionCategory,
  type PermissionModule,
} from '@twicely/casl/permission-registry';

interface PermissionToggleGridProps {
  /** Current permissions as { subject, action }[] */
  permissions: Array<{ subject: string; action: string }>;
  /** Called with the full updated permissions array on any toggle change */
  onChange: (permissions: Array<{ subject: string; action: string }>) => void;
  /** When true, all toggles are disabled (for read-only view of system roles) */
  readOnly?: boolean;
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

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function isEnabled(
  permissions: Array<{ subject: string; action: string }>,
  subject: string,
  action: string
): boolean {
  return permissions.some((p) => p.subject === subject && p.action === action);
}

interface ToggleSwitchProps {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
}

function ToggleSwitch({ enabled, disabled, onToggle, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={[
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full',
        'transition-colors duration-200 ease-in-out',
        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1',
        enabled ? 'bg-purple-600' : 'bg-gray-200',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200',
          enabled ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

interface ModuleRowProps {
  mod: PermissionModule;
  permissions: Array<{ subject: string; action: string }>;
  readOnly: boolean;
  onToggle: (subject: string, action: string, on: boolean) => void;
}

function ModuleRow({ mod, permissions, readOnly, onToggle }: ModuleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 px-4 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{mod.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{mod.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        {mod.actions.map((a) => {
          const on = isEnabled(permissions, mod.subject, a.action);
          return (
            <div key={a.action} className="flex flex-col items-center gap-1">
              <ToggleSwitch
                enabled={on}
                disabled={readOnly}
                label={`${mod.name}: ${getActionLabel(a.action)}`}
                onToggle={() => onToggle(mod.subject, a.action, !on)}
              />
              <span className="text-xs text-gray-500">{getActionLabel(a.action)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CategorySectionProps {
  category: PermissionCategory;
  modules: PermissionModule[];
  permissions: Array<{ subject: string; action: string }>;
  readOnly: boolean;
  onToggle: (subject: string, action: string, on: boolean) => void;
}

function CategorySection({
  category,
  modules,
  permissions,
  readOnly,
  onToggle,
}: CategorySectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {CATEGORY_LABELS[category]}
        </h3>
      </div>
      <div className="bg-white divide-y divide-gray-50">
        {modules.map((mod) => (
          <ModuleRow
            key={mod.subject}
            mod={mod}
            permissions={permissions}
            readOnly={readOnly}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

export function PermissionToggleGrid({
  permissions,
  onChange,
  readOnly = false,
}: PermissionToggleGridProps) {
  const byCategory = getModulesByCategory();
  const categoryOrder: PermissionCategory[] = [
    'USERS_AND_STAFF',
    'COMMERCE',
    'FINANCE',
    'TRUST_AND_SAFETY',
    'CONTENT',
    'PLATFORM',
  ];

  function handleToggle(subject: string, action: string, on: boolean) {
    if (readOnly) return;
    if (on) {
      onChange([...permissions, { subject, action }]);
    } else {
      onChange(permissions.filter((p) => !(p.subject === subject && p.action === action)));
    }
  }

  const totalModuleActions = PERMISSION_MODULES.reduce((sum, m) => sum + m.actions.length, 0);
  const selectedCount = permissions.length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{selectedCount}</span>
        {' '}of{' '}
        <span className="font-semibold text-gray-900">{totalModuleActions}</span>
        {' '}permissions selected
      </p>
      {categoryOrder.map((cat) => {
        const modules = byCategory.get(cat);
        if (!modules?.length) return null;
        return (
          <CategorySection
            key={cat}
            category={cat}
            modules={modules}
            permissions={permissions}
            readOnly={readOnly}
            onToggle={handleToggle}
          />
        );
      })}
    </div>
  );
}
