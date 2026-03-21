'use client';

import { useState, useTransition } from 'react';

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'secret' | 'select';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string | number | boolean;
}

interface Props {
  schema: ConfigField[];
  initialConfig: Record<string, unknown>;
  secretMasks: Record<string, string>;
  onSave: (config: Record<string, unknown>, secrets: Record<string, string>) => Promise<{ error?: string }>;
  canEdit: boolean;
}

export function ProviderConfigForm({ schema, initialConfig, secretMasks, onSave, canEdit }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of schema) {
      v[f.key] = f.type === 'secret' ? '' : (initialConfig[f.key] ?? f.defaultValue ?? '');
    }
    return v;
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function handleChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const config: Record<string, unknown> = {};
    const secrets: Record<string, string> = {};
    for (const f of schema) {
      if (f.type === 'secret') {
        const val = values[f.key] as string;
        if (val) secrets[f.key] = val;
      } else {
        config[f.key] = values[f.key];
      }
    }
    startTransition(async () => {
      const result = await onSave(config, secrets);
      if (result.error) { setError(result.error); }
      else { setSaved(true); setError(''); setTimeout(() => setSaved(false), 3000); }
    });
  }

  const inputCls = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50';

  return (
    <div className="space-y-4">
      {schema.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700">
            {f.label}
            {f.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
          {f.helpText && <p className="mt-0.5 text-xs text-gray-400">{f.helpText}</p>}

          {f.type === 'boolean' ? (
            <button type="button" role="switch" aria-checked={!!values[f.key]}
              disabled={!canEdit} onClick={() => handleChange(f.key, !values[f.key])}
              className={`mt-1 relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${values[f.key] ? 'bg-gray-900' : 'bg-gray-200'} ${!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${values[f.key] ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          ) : f.type === 'select' ? (
            <select value={values[f.key] as string} onChange={(e) => handleChange(f.key, e.target.value)}
              disabled={!canEdit} className={inputCls}>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === 'secret' ? (
            <div className="mt-1">
              {secretMasks[f.key] && <p className="mb-1 text-xs text-gray-400">Current: {secretMasks[f.key]}</p>}
              <input type="password" value={values[f.key] as string}
                onChange={(e) => handleChange(f.key, e.target.value)}
                placeholder={secretMasks[f.key] ? 'Leave blank to keep current' : f.placeholder ?? ''}
                disabled={!canEdit} className={inputCls} />
            </div>
          ) : f.type === 'number' ? (
            <input type="number" value={values[f.key] as number}
              onChange={(e) => handleChange(f.key, Number(e.target.value))}
              placeholder={f.placeholder} disabled={!canEdit} className={inputCls} />
          ) : (
            <input type="text" value={values[f.key] as string}
              onChange={(e) => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder} disabled={!canEdit} className={inputCls} />
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Configuration saved</p>}

      {canEdit && (
        <button type="button" onClick={handleSubmit} disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
          {isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      )}
    </div>
  );
}
