'use client';

import { useState, useTransition } from 'react';
import { createInstance, saveInstanceConfig } from '@/lib/actions/admin-providers';
import { ProviderConfigForm, type ConfigField } from './provider-config-form';

interface Props {
  mode: 'create' | 'edit';
  adapterId: string;
  adapterName: string;
  configSchema: ConfigField[];
  instanceId?: string;
  initialName?: string;
  initialDisplayName?: string;
  initialConfig?: Record<string, unknown>;
  secretMasks?: Record<string, string>;
  canEdit: boolean;
}

export function ProviderInstanceForm({
  mode, adapterId, adapterName, configSchema,
  instanceId, initialName, initialDisplayName,
  initialConfig = {}, secretMasks = {}, canEdit,
}: Props) {
  const [name, setName] = useState(initialName ?? '');
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
  const [created, setCreated] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(instanceId ?? null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const inputCls = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50';

  if (mode === 'create' && !created) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          New {adapterName} Instance
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Instance Name<span className="ml-0.5 text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-400">Unique identifier (e.g., &quot;stripe-production&quot;)</p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="stripe-production" disabled={!canEdit} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Display Name<span className="ml-0.5 text-red-500">*</span>
          </label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Stripe (Production)" disabled={!canEdit} className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="button" disabled={isPending || !name || !displayName}
            onClick={() => {
              startTransition(async () => {
                const result = await createInstance({
                  adapterId, name, displayName, priority: 100,
                });
                if (result.error) { setError(result.error); return; }
                setCreatedId(result.id ?? null);
                setCreated(true);
              });
            }}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {isPending ? 'Creating...' : 'Create Instance'}
          </button>
        </div>
      </div>
    );
  }

  // Edit mode (or just created — now configure)
  const effectiveId = createdId ?? instanceId;
  if (!effectiveId) return <p className="text-sm text-red-600">No instance ID</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {created ? 'Configure' : 'Configuration'}: {displayName || initialDisplayName}
        </h3>
        {created && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Instance created
          </span>
        )}
      </div>

      {configSchema.length === 0 ? (
        <p className="text-sm text-gray-500">No configuration fields for this adapter.</p>
      ) : (
        <ProviderConfigForm
          schema={configSchema}
          initialConfig={initialConfig}
          secretMasks={secretMasks}
          canEdit={canEdit}
          onSave={async (config, secrets) => {
            const result = await saveInstanceConfig({
              instanceId: effectiveId,
              configJson: config,
              secrets,
            });
            return result.error ? { error: result.error } : {};
          }}
        />
      )}
    </div>
  );
}
