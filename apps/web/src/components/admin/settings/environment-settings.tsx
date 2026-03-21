'use client';

import { useState, useTransition } from 'react';
import { updatePlatformSetting } from '@/lib/actions/admin-settings';

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  type: string;
  description: string | null;
  isSecret: boolean;
}

interface EnvironmentSettingsProps {
  groupedSettings: Record<string, SettingRow[]>;
  canEdit: boolean;
}

function SettingCard({ setting, canEdit }: { setting: SettingRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setEditing(true);
    setEditValue(setting.isSecret ? '' : String(setting.value ?? ''));
  }

  function handleSave() {
    if (!editValue.trim()) return;
    startTransition(async () => {
      await updatePlatformSetting(setting.id, editValue);
      setEditing(false);
      setEditValue('');
    });
  }

  const hasValue = setting.value !== null && setting.value !== undefined && setting.value !== '';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{setting.key}</h3>
            {setting.isSecret && (
              <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">Encrypted</span>
            )}
            {hasValue ? (
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Configured</span>
            ) : (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Not Set</span>
            )}
          </div>
          {setting.description && (
            <p className="mt-1 text-sm text-gray-600">{setting.description}</p>
          )}

          {editing ? (
            <div className="mt-3">
              <input
                type={setting.isSecret ? 'password' : 'text'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={setting.isSecret ? 'Enter new value' : 'Enter value'}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={handleSave} disabled={isPending || !editValue.trim()}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400">
                  {isPending ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} disabled={isPending}
                  className="rounded bg-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <code className="rounded bg-gray-100 px-2 py-1 text-sm">
                {setting.isSecret ? (hasValue ? '••••••••' : '(not set)') : String(setting.value ?? '(not set)')}
              </code>
            </div>
          )}
        </div>

        {!editing && canEdit && (
          <button onClick={startEdit}
            className="ml-4 rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

export function EnvironmentSettings({ groupedSettings, canEdit }: EnvironmentSettingsProps) {
  const categories = Object.keys(groupedSettings);

  if (categories.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No environment settings found. Run the seed to populate platform settings.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-4 border-b pb-2 text-lg font-semibold capitalize text-gray-900">
            {category.replace(/_/g, ' ')}
          </h2>
          <div className="space-y-4">
            {(groupedSettings[category] ?? []).map((setting) => (
              <SettingCard key={setting.id} setting={setting} canEdit={canEdit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
