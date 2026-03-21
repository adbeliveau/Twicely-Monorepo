'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateTrustSettings } from '@/lib/actions/admin-trust';

interface TrustSetting {
  key: string;
  label: string;
  description: string;
  type: 'toggle' | 'select';
  value: unknown;
  options?: { label: string; value: string }[];
}

interface TrustSettingsFormProps {
  settings: TrustSetting[];
  canEdit: boolean;
}

function TrustToggle({ setting, canEdit }: { setting: TrustSetting; canEdit: boolean }) {
  const [checked, setChecked] = useState(setting.value === true);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      const result = await updateTrustSettings({ key: setting.key, value: next });
      if (!result.success) {
        setChecked(!next);
        toast.error(result.error ?? 'Failed to update setting');
      }
    });
  }

  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{setting.label}</p>
        <p className="text-xs text-gray-500">{setting.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={!canEdit || isPending}
        onClick={handleToggle}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-gray-900' : 'bg-gray-200',
          (!canEdit || isPending) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <span className={[
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')} />
      </button>
    </div>
  );
}

function TrustSelect({ setting, canEdit }: { setting: TrustSetting; canEdit: boolean }) {
  const [value, setValue] = useState(String(setting.value ?? ''));
  const [isPending, startTransition] = useTransition();

  function handleChange(newVal: string) {
    setValue(newVal);
    startTransition(async () => {
      const result = await updateTrustSettings({ key: setting.key, value: newVal });
      if (!result.success) {
        setValue(String(setting.value ?? ''));
        toast.error(result.error ?? 'Failed to update setting');
      }
    });
  }

  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{setting.label}</p>
        <p className="text-xs text-gray-500">{setting.description}</p>
      </div>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={!canEdit || isPending}
        className="rounded-md border border-gray-200 px-2 py-1 text-sm disabled:opacity-50"
      >
        {setting.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function TrustSettingsForm({ settings, canEdit }: TrustSettingsFormProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {settings.map((s) =>
        s.type === 'toggle' ? (
          <TrustToggle key={s.key} setting={s} canEdit={canEdit} />
        ) : (
          <TrustSelect key={s.key} setting={s} canEdit={canEdit} />
        )
      )}
    </div>
  );
}
