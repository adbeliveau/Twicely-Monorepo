'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateIntegrationKeys, testShippoConnection, toggleIntegrationModule } from '@/lib/actions/admin-integrations';
import type { IntegrationSettings } from '@/lib/queries/admin-integrations';

interface ShippoSettingsFormProps {
  settings: IntegrationSettings;
  canEdit: boolean;
}

const SHIPPO_WEBHOOK_EVENTS = [
  'track_updated',
  'transaction_created',
  'transaction_updated',
  'batch_created',
  'batch_purchased',
];

export function ShippoSettingsForm({ settings, canEdit }: ShippoSettingsFormProps) {
  const [enabled, setEnabled] = useState(settings.moduleEnabled);
  const [testKey, setTestKey] = useState('');
  const [liveKey, setLiveKey] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const result = await toggleIntegrationModule({ moduleKey: 'integrations.shippo.enabled', enabled: next });
      if (!result.success) {
        setEnabled(!next);
        toast.error(result.error ?? 'Failed to update Shippo module');
      }
    });
  }

  function handleSaveKeys() {
    startTransition(async () => {
      const payload: Record<string, string> = { provider: 'shippo' };
      if (testKey) payload.testSecretKey = testKey;
      if (liveKey) payload.liveSecretKey = liveKey;
      const result = await updateIntegrationKeys(payload);
      if (result.success) {
        setTestKey('');
        setLiveKey('');
      } else {
        toast.error(result.error ?? 'Failed to save keys');
      }
    });
  }

  function handleTestConnection() {
    startTransition(async () => {
      const result = await testShippoConnection();
      if (result.success) {
        setTestResult(result.message ?? 'Connected');
      } else {
        setTestResult(result.message ?? 'Connection failed');
        toast.error(result.message ?? 'Shippo connection test failed');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Module toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Shippo Shipping Module</h3>
          <p className="text-xs text-gray-500">Enable Shippo for multi-carrier rates and label generation</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canEdit || isPending}
          onClick={handleToggle}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
            enabled ? 'bg-green-600' : 'bg-gray-200',
            (!canEdit || isPending) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <span className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')} />
        </button>
      </div>

      {/* API Keys */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">API Keys</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Test API Token</label>
            <input
              type="password"
              placeholder={settings.hasTestSecretKey ? '••••••••••••••••' : 'shippo_test_...'}
              value={testKey}
              onChange={(e) => setTestKey(e.target.value)}
              disabled={!canEdit || isPending}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50"
            />
            {settings.hasTestSecretKey && <p className="mt-1 text-xs text-green-600">Configured</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Live API Token</label>
            <input
              type="password"
              placeholder={settings.hasLiveSecretKey ? '••••••••••••••••' : 'shippo_live_...'}
              value={liveKey}
              onChange={(e) => setLiveKey(e.target.value)}
              disabled={!canEdit || isPending}
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50"
            />
            {settings.hasLiveSecretKey && <p className="mt-1 text-xs text-green-600">Configured</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveKeys}
            disabled={!canEdit || isPending || (!testKey && !liveKey)}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Save Keys
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Test Connection
          </button>
        </div>

        {testResult && (
          <p className="text-sm text-gray-600">{testResult}</p>
        )}
      </div>

      {/* Webhooks */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Webhook Configuration</h3>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL</label>
          <code className="block rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            {settings.webhookUrl ?? 'https://twicely.co/api/webhooks/shippo'}
          </code>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">Required Events</p>
          <div className="flex flex-wrap gap-1">
            {SHIPPO_WEBHOOK_EVENTS.map((evt) => (
              <code key={evt} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                {evt}
              </code>
            ))}
          </div>
        </div>
      </div>

      {/* Label format info */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">Label Settings</h3>
        <p className="mt-1 text-xs text-gray-500">
          Default label format: 4x6 thermal (PNG). Configure in Shippo Dashboard for custom formats.
        </p>
      </div>
    </div>
  );
}
