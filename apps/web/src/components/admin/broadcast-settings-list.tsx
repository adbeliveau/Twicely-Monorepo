'use client';

import { useState, useTransition } from 'react';
import { updateBroadcastSettingAction } from '@/lib/actions/admin-broadcast';
import type { BroadcastSettingRow } from '@/lib/queries/admin-broadcast';

interface BroadcastRowFormProps {
  setting: BroadcastSettingRow;
  canEdit: boolean;
}

function BroadcastRowForm({ setting, canEdit }: BroadcastRowFormProps) {
  const [value, setValue] = useState(setting.value);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setStatus('idle');
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateBroadcastSettingAction(setting.key, value);
      if ('error' in result) {
        setStatus('error');
        setErrorMsg(result.error);
      } else {
        setStatus('saved');
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <div className="space-y-0.5">
        <p className="text-xs font-mono text-gray-500">{setting.key}</p>
        {setting.label && (
          <p className="text-sm font-medium text-gray-800">{setting.label}</p>
        )}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus('idle');
            }}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label={`Value for ${setting.key}`}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-primary px-3 py-1 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-700 font-mono">{setting.value}</p>
      )}
      {status === 'saved' && (
        <p className="text-xs text-green-600">Saved.</p>
      )}
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}

interface BroadcastSettingsListProps {
  settings: BroadcastSettingRow[];
  canEdit: boolean;
}

export function BroadcastSettingsList({ settings, canEdit }: BroadcastSettingsListProps) {
  return (
    <div className="space-y-3">
      {settings.map((s) => (
        <BroadcastRowForm key={s.key} setting={s} canEdit={canEdit} />
      ))}
    </div>
  );
}
