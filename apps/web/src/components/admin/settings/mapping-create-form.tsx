'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUsageMapping } from '@/lib/actions/admin-providers';
import { SERVICE_TYPES, type ServiceType } from '@/lib/validations/admin-provider-mapping';

interface InstanceOption {
  id: string;
  displayName: string;
  adapterName: string;
  status: string;
}

interface Props {
  instances: InstanceOption[];
}

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

export function MappingCreateForm({ instances }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [usageKey, setUsageKey] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('EMAIL');
  const [primaryInstanceId, setPrimaryInstanceId] = useState('');
  const [fallbackInstanceId, setFallbackInstanceId] = useState<string>('');
  const [autoFailover, setAutoFailover] = useState(false);

  const filteredInstances = instances; // all available regardless of serviceType

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!usageKey.trim()) { setError('Usage key is required'); return; }
    if (!primaryInstanceId) { setError('Primary instance is required'); return; }

    startTransition(async () => {
      const result = await createUsageMapping({
        usageKey: usageKey.trim(),
        description: description.trim() || undefined,
        serviceType,
        primaryInstanceId,
        fallbackInstanceId: fallbackInstanceId || null,
        autoFailover,
      });

      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }

      router.push('/cfg/providers/mappings');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className={labelCls}>Usage Key</label>
        <input type="text" value={usageKey} onChange={(e) => setUsageKey(e.target.value)}
          className={inputCls} placeholder="e.g. email.transactional" disabled={isPending} />
        <p className="mt-1 text-xs text-gray-400">A dot-separated key identifying where this provider is used</p>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          className={inputCls} placeholder="Optional description" disabled={isPending} />
      </div>

      <div>
        <label className={labelCls}>Service Type</label>
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}
          className={inputCls} disabled={isPending}>
          {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Primary Instance</label>
        <select value={primaryInstanceId} onChange={(e) => setPrimaryInstanceId(e.target.value)}
          className={inputCls} disabled={isPending}>
          <option value="">Select primary instance...</option>
          {filteredInstances.map((i) => (
            <option key={i.id} value={i.id}>{i.displayName} ({i.adapterName})</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Fallback Instance (optional)</label>
        <select value={fallbackInstanceId} onChange={(e) => setFallbackInstanceId(e.target.value)}
          className={inputCls} disabled={isPending}>
          <option value="">None</option>
          {filteredInstances.filter((i) => i.id !== primaryInstanceId).map((i) => (
            <option key={i.id} value={i.id}>{i.displayName} ({i.adapterName})</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label className={labelCls + ' mb-0'}>Auto-Failover</label>
        <button type="button" role="switch" aria-checked={autoFailover}
          onClick={() => setAutoFailover(!autoFailover)} disabled={isPending}
          className={['relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
            autoFailover ? 'bg-gray-900' : 'bg-gray-200',
            isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'].join(' ')}>
          <span className={['inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            autoFailover ? 'translate-x-4' : 'translate-x-0'].join(' ')} />
        </button>
        <span className="text-xs text-gray-500">Automatically switch to fallback on failure</span>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.push('/cfg/providers/mappings')}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          disabled={isPending}>
          Cancel
        </button>
        <button type="submit" disabled={isPending}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
          {isPending ? 'Creating...' : 'Create Mapping'}
        </button>
      </div>
    </form>
  );
}
