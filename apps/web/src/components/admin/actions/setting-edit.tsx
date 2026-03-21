'use client';

import { useTransition, useState } from 'react';
import { updateSettingAction } from '@/lib/actions/admin-settings';

interface SettingEditProps {
  settingId: string;
  settingKey: string;
  value: unknown;
  type: string;
  isSecret: boolean;
}

export function SettingEdit({ settingId, settingKey, value, type, isSecret }: SettingEditProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [result, setResult] = useState<string | null>(null);

  function handleSave() {
    const reason = prompt(`Reason for changing "${settingKey}":`);
    if (!reason) return;

    let parsedValue: unknown = editValue;
    if (type === 'number' || type === 'cents' || type === 'bps') parsedValue = Number(editValue);
    else if (type === 'boolean') parsedValue = editValue === 'true';
    else if (type === 'json') {
      try { parsedValue = JSON.parse(editValue); } catch { setResult('Invalid JSON'); return; }
    }

    startTransition(async () => {
      const res = await updateSettingAction({ settingId, value: parsedValue, reason });
      setResult(res.error ?? 'Updated');
      if (!res.error) setEditing(false);
    });
  }

  if (isSecret) return <span className="text-xs text-gray-400">Secret (not editable)</span>;

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50">
        Edit
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {type === 'boolean' ? (
        <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="rounded border px-1.5 py-0.5 text-xs">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-32 rounded border px-1.5 py-0.5 text-xs" />
      )}
      <button onClick={handleSave} disabled={pending} className="rounded bg-gray-900 px-2 py-0.5 text-xs text-white disabled:opacity-50">Save</button>
      <button onClick={() => { setEditing(false); setResult(null); }} className="text-xs text-gray-500">Cancel</button>
      {result && <span className="text-xs text-gray-500">{result}</span>}
    </div>
  );
}
