'use client';

import { useState, useTransition } from 'react';
import {
  updateConnectorSettings,
  testConnectorConnection,
} from '@/lib/actions/admin-connector-settings';
import type { ConnectorSetting, ConnectorStats } from '@/lib/queries/admin-connector-settings';

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthType = 'OAUTH' | 'SESSION';

interface ConnectorCapabilities {
  canImport: boolean;
  canPublish: boolean;
  canUpdate: boolean;
  canDelist: boolean;
  hasWebhooks: boolean;
  canShare: boolean;
  canAutoRelist: boolean;
  canMakeOffers: boolean;
  maxImagesPerListing: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
}

interface WebhookConfig {
  url: string;
  events: string[];
}

interface ConnectorConfig {
  code: string;
  displayName: string;
  authType: AuthType;
  callbackUrl?: string;
  webhookConfig?: WebhookConfig;
  capabilities: ConnectorCapabilities;
  docsUrl: string;
  description: string;
  settingsPrefix: string;
}

interface Props {
  config: ConnectorConfig;
  settings: ConnectorSetting[];
  stats: ConnectorStats;
  canEdit: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isSecret(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes('secret') || lower.includes('token');
}

function maskValue(value: unknown): string {
  const str = String(value ?? '');
  if (!str || str.length <= 4) return str ? '••••••••' : '';
  return '••••••••' + str.slice(-4);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConnectorSettingsPage({ config, settings, stats, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of settings) {
      initial[s.key] = isSecret(s.key) ? '' : String(s.value ?? '');
    }
    return initial;
  });

  const inputCls = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50';
  const sectionCls = 'rounded-lg border border-gray-200 bg-white p-5 space-y-4';

  const handleTestConnection = () => {
    startTestTransition(async () => {
      setTestResult(null);
      const result = await testConnectorConnection({ connectorCode: config.code });
      if ('error' in result) {
        setTestResult({ success: false, message: result.error });
      } else {
        setTestResult({ success: result.success, message: result.message });
      }
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      setSaveResult(null);
      const settingsToSave: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(formValues)) {
        if (isSecret(key) && !val) continue;
        const original = settings.find((s) => s.key === key);
        if (original?.type === 'boolean') {
          settingsToSave[key] = val === 'true';
        } else {
          settingsToSave[key] = val;
        }
      }
      const result = await updateConnectorSettings({
        connectorCode: config.code,
        settings: settingsToSave,
      });
      setSaveResult(result.error
        ? { type: 'error', msg: result.error }
        : { type: 'success', msg: 'Settings saved' });
    });
  };

  // Group settings by type
  const enableSettings = settings.filter((s) => s.key.endsWith('Enabled'));
  const credentialSettings = settings.filter((s) =>
    s.key.includes('clientId') || s.key.includes('clientSecret') ||
    s.key.includes('redirectUri') || s.key.includes('apiBase') ||
    s.key.includes('userAgent') || s.key.includes('environment')
  );

  return (
    <div className="space-y-6">
      {/* Module Status */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Module Status</h3>
        {enableSettings.map((s) => {
          const label = s.key.split('.').pop()?.replace('Enabled', '') ?? s.key;
          const isOn = formValues[s.key] === 'true' || s.value === true;
          return (
            <div key={s.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 capitalize">{label}</p>
                <p className="text-xs text-gray-500">{s.description}</p>
              </div>
              <button type="button" disabled={!canEdit}
                onClick={() => setFormValues((p) => ({ ...p, [s.key]: String(!isOn) }))}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${isOn ? 'bg-purple-600' : 'bg-gray-300'} disabled:opacity-50`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${isOn ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Credentials / Config */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">
          {config.authType === 'OAUTH' ? 'OAuth Credentials' : 'Connection Settings'}
        </h3>
        <p className="text-xs text-gray-500">
          {config.authType === 'OAUTH'
            ? `Configure ${config.displayName} OAuth application credentials.`
            : `Configure ${config.displayName} API connection settings.`}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credentialSettings.map((s) => {
            const label = s.key.split('.').pop() ?? s.key;
            const secret = isSecret(s.key);
            const currentMask = secret ? maskValue(s.value) : undefined;
            return (
              <div key={s.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                  {label.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <input type={secret ? 'password' : 'text'}
                  value={formValues[s.key] ?? ''} disabled={!canEdit}
                  placeholder={currentMask ?? ''} className={inputCls}
                  onChange={(e) => setFormValues((p) => ({ ...p, [s.key]: e.target.value }))} />
                {secret && currentMask && (
                  <p className="text-xs text-gray-400 mt-0.5">Current: {currentMask}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* OAuth Callback URL */}
      {config.callbackUrl && (
        <div className={sectionCls}>
          <h3 className="text-sm font-semibold text-gray-900">OAuth Callback URL</h3>
          <code className="block rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            {config.callbackUrl}
          </code>
        </div>
      )}

      {/* Webhook Configuration */}
      {config.webhookConfig && (
        <div className={sectionCls}>
          <h3 className="text-sm font-semibold text-gray-900">Webhook Configuration</h3>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL</label>
            <code className="block rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
              {config.webhookConfig.url}
            </code>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-700">Required Events</p>
            <div className="flex flex-wrap gap-1">
              {config.webhookConfig.events.map((evt) => (
                <code key={evt} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{evt}</code>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Capabilities */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Capabilities</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(config.capabilities).map(([k, v]) => {
            if (typeof v === 'number') {
              return (
                <div key={k} className="text-center p-2 rounded-md bg-gray-50">
                  <p className="text-lg font-semibold text-gray-900">{v}</p>
                  <p className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
              );
            }
            return (
              <div key={k} className="flex items-center gap-2 p-2 rounded-md bg-gray-50">
                <span className={`text-sm ${v ? 'text-green-600' : 'text-gray-400'}`}>{v ? '✓' : '✗'}</span>
                <span className="text-xs text-gray-700 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected Accounts */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Connected Accounts</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-md bg-gray-50">
            <p className="text-2xl font-bold text-gray-900">{stats.connectedAccounts}</p>
            <p className="text-xs text-gray-500">Total Connected</p>
          </div>
          <div className="text-center p-3 rounded-md bg-gray-50">
            <p className="text-2xl font-bold text-green-600">{stats.activeAccounts}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
        </div>
      </div>

      {/* Save + Test + Docs */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          See{' '}
          <a href={config.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800">{config.displayName} documentation</a>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={isTestPending} onClick={handleTestConnection}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {isTestPending ? 'Testing...' : 'Test Connection'}
          </button>
          <button type="button" disabled={isPending || !canEdit} onClick={handleSave}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {saveResult && (
        <p className={`text-sm ${saveResult.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {saveResult.msg}
        </p>
      )}

      {testResult && (
        <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.message}
        </p>
      )}
    </div>
  );
}
