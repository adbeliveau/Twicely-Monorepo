'use client';

import { useState, useTransition } from 'react';
import { updatePlatformSetting } from '@/lib/actions/admin-settings';
import { formatValue, toInputValue, fromInputValue, getInputPrefix, getInputSuffix } from './settings-display';
import type { TierTableDef } from './settings-sections';

interface SettingItem {
  id: string;
  key: string;
  value: unknown;
  type: string;
}

interface TierTableProps {
  def: TierTableDef;
  settings: Record<string, SettingItem>;
  canEdit: boolean;
}

export function TierTable({ def, settings, canEdit }: TierTableProps) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function startEdit() {
    const v: Record<string, string> = {};
    for (const row of def.rows) {
      for (const key of row.keys) {
        if (!key) continue;
        const s = settings[key];
        if (s) v[key] = toInputValue(s.value, s.type, s.key);
      }
    }
    setValues(v);
    setEditing(true);
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      for (const [key, val] of Object.entries(values)) {
        const s = settings[key];
        if (!s) continue;
        const original = toInputValue(s.value, s.type, s.key);
        if (val !== original) {
          await updatePlatformSetting(s.id, fromInputValue(val, s.type, s.key));
        }
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function cellView(key: string): string {
    if (!key) return '—';
    const s = settings[key];
    if (!s) return '—';
    return formatValue(s.value, s.type, s.key);
  }

  function cellEdit(key: string): React.ReactNode {
    if (!key) return <span className="text-gray-300">—</span>;
    const s = settings[key];
    if (!s) return <span className="text-gray-300">—</span>;
    const pre = getInputPrefix(s.type, s.key);
    const suf = getInputSuffix(s.type, s.key);
    return (
      <div className="flex items-center gap-1">
        {pre && <span className="text-xs text-gray-400">{pre}</span>}
        <input type="text" value={values[key] ?? ''}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-right text-sm focus:border-blue-500 focus:outline-none" />
        {suf && <span className="text-xs text-gray-400">{suf}</span>}
      </div>
    );
  }

  const btn = 'rounded px-3 py-1.5 text-xs font-medium';

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h4 className="text-sm font-medium text-gray-700">{def.title}</h4>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Saved!</span>}
          {canEdit && !editing && (
            <button onClick={startEdit} className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>Edit</button>
          )}
        </div>
      </div>
      {def.help && (
        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">{def.help}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-2">{def.rowHeader}</th>
              {def.columns.map((c) => <th key={c} className="px-4 py-2">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {def.rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-2 text-gray-600">{row.label}</td>
                {row.keys.map((key, i) => (
                  <td key={key || i} className="px-4 py-2 font-medium text-gray-900">
                    {editing ? cellEdit(key) : cellView(key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button onClick={() => setEditing(false)} disabled={isPending}
            className={`${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`}>Cancel</button>
          <button onClick={handleSave} disabled={isPending}
            className={`${btn} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`}>
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
