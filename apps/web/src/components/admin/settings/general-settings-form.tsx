'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updatePlatformSetting } from '@/lib/actions/admin-settings';

interface GeneralSetting {
  id: string;
  key: string;
  value: unknown;
  type: string;
  description: string | null;
}

interface GeneralSettingsFormProps {
  settings: GeneralSetting[];
  canEdit: boolean;
}

function SettingToggle({
  setting,
  canEdit,
}: {
  setting: GeneralSetting;
  canEdit: boolean;
}) {
  const [checked, setChecked] = useState(setting.value === true);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (!canEdit) return;
    const newVal = !checked;
    setChecked(newVal);
    startTransition(async () => {
      const result = await updatePlatformSetting(setting.id, newVal);
      if (!result.success) {
        setChecked(!newVal);
        toast.error(result.error ?? 'Failed to update setting');
      }
    });
  }

  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{setting.key}</p>
        {setting.description && (
          <p className="text-xs text-gray-500">{setting.description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={!canEdit || isPending}
        onClick={handleToggle}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-gray-900' : 'bg-gray-200',
          (!canEdit || isPending) ? 'opacity-50 cursor-not-allowed' : '',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

function SettingInput({
  setting,
  canEdit,
}: {
  setting: GeneralSetting;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(String(setting.value ?? ''));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!canEdit) return;
    startTransition(async () => {
      const parsed = setting.type === 'number' ? Number(value) : value;
      const result = await updatePlatformSetting(setting.id, parsed);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save setting');
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{setting.key}</p>
        {setting.description && (
          <p className="text-xs text-gray-500">{setting.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type={setting.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!canEdit || isPending}
          className="w-48 rounded-md border border-gray-200 px-2 py-1 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || isPending}
          className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function GeneralSettingsForm({ settings, canEdit }: GeneralSettingsFormProps) {
  if (settings.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-gray-400">
        No general settings configured
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {settings.map((s) =>
        s.type === 'boolean' ? (
          <SettingToggle key={s.id} setting={s} canEdit={canEdit} />
        ) : (
          <SettingInput key={s.id} setting={s} canEdit={canEdit} />
        )
      )}
    </div>
  );
}
