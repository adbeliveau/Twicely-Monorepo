'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toggleModule } from '@/lib/actions/admin-modules';

interface ModuleCardProps {
  moduleId: string;
  label: string;
  description: string | null;
  state: string;
  version: string;
  configPath: string | null;
  canEdit: boolean;
  onUninstall: (moduleId: string) => void;
}

const STATE_BADGES: Record<string, { bg: string; text: string }> = {
  ENABLED: { bg: 'bg-green-100', text: 'text-green-700' },
  DISABLED: { bg: 'bg-gray-100', text: 'text-gray-600' },
  BETA: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  DEPRECATED: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function ModuleCard({
  moduleId,
  label,
  description,
  state,
  version,
  configPath,
  canEdit,
  onUninstall,
}: ModuleCardProps) {
  const [enabled, setEnabled] = useState(state === 'ENABLED' || state === 'BETA');
  const [isPending, startTransition] = useTransition();
  const badge = STATE_BADGES[state] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      await toggleModule({ moduleId, enabled: next });
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
              {state}
            </span>
            <span className="text-xs text-gray-400">v{version}</span>
          </div>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canEdit || isPending || state === 'DEPRECATED'}
          onClick={handleToggle}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
            enabled ? 'bg-green-600' : 'bg-gray-200',
            (!canEdit || isPending || state === 'DEPRECATED') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <span className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {configPath && (
          <Link
            href={configPath}
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            Configure
          </Link>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => onUninstall(moduleId)}
            disabled={isPending}
            className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Uninstall
          </button>
        )}
      </div>
    </div>
  );
}
