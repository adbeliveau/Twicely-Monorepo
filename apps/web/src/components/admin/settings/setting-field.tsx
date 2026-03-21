'use client';

/**
 * Individual setting field renderer — displays label, description,
 * type-appropriate value, and an edit button.
 */

import { SettingEdit } from '@/components/admin/actions/setting-edit';

interface SettingFieldProps {
  settingId: string;
  settingKey: string;
  value: unknown;
  type: string;
  description: string | null;
  isSecret: boolean;
  canEdit: boolean;
}

function formatValue(value: unknown, type: string, isSecret: boolean): string {
  if (isSecret) return '••••••••';
  if (type === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (type === 'cents') return `$${(Number(value) / 100).toFixed(2)}`;
  if (type === 'bps') return `${(Number(value) / 100).toFixed(2)}%`;
  if (type === 'json') return JSON.stringify(value, null, 2);
  return String(value ?? '');
}

function valueColor(type: string, value: unknown): string {
  if (type === 'boolean') return value ? 'text-green-700' : 'text-red-700';
  return 'text-gray-900';
}

export function SettingField({
  settingId,
  settingKey,
  value,
  type,
  description,
  isSecret,
  canEdit,
}: SettingFieldProps) {
  const displayValue = formatValue(value, type, isSecret);

  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{settingKey}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 text-right">
          <p className={`text-sm font-mono ${valueColor(type, value)}`}>
            {type === 'json' ? (
              <span className="block max-w-[200px] truncate">{displayValue}</span>
            ) : (
              displayValue
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{type}</p>
        </div>
        {canEdit && (
          <SettingEdit settingId={settingId} settingKey={settingKey} value={value} type={type} isSecret={isSecret} />
        )}
      </div>
    </div>
  );
}
