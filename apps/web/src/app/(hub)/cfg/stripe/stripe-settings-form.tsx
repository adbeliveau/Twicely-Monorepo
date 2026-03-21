'use client';

import { useState, useTransition } from 'react';
import {
  updateIntegrationKeys,
  testStripeConnection,
  toggleIntegrationModule,
} from '@/lib/actions/admin-integrations';
import { saveGeneralSettings } from '@/lib/actions/admin-settings';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SecretMasks {
  test_secret_key?: string;
  test_publishable_key?: string;
  live_secret_key?: string;
  live_publishable_key?: string;
  webhook_signing_secret?: string;
  connect_webhook_secret?: string;
}

interface StripeConfig {
  stripeEnabled: boolean;
  testMode: boolean;
  statementDescriptor: string;
  defaultCurrency: string;
  connectCountry: string;
  autoTransfer: boolean;
  transferDelayHours: number;
}

interface Props {
  initialConfig: StripeConfig;
  secretMasks: SecretMasks;
  canEdit: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StripeSettingsForm({ initialConfig, secretMasks, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Toggles
  const [stripeEnabled, setStripeEnabled] = useState(initialConfig.stripeEnabled);
  const [testMode, setTestMode] = useState(initialConfig.testMode);

  // API Keys
  const [testSecretKey, setTestSecretKey] = useState('');
  const [testPublishableKey, setTestPublishableKey] = useState('');
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [livePublishableKey, setLivePublishableKey] = useState('');

  // Webhook secrets
  const [webhookSigningSecret, setWebhookSigningSecret] = useState('');
  const [connectWebhookSecret, setConnectWebhookSecret] = useState('');

  // Payment Settings
  const [statementDescriptor, setStatementDescriptor] = useState(initialConfig.statementDescriptor);
  const [defaultCurrency, setDefaultCurrency] = useState(initialConfig.defaultCurrency);

  // Connect
  const [connectCountry, setConnectCountry] = useState(initialConfig.connectCountry);
  const [autoTransfer, setAutoTransfer] = useState(initialConfig.autoTransfer);
  const [transferDelayHours, setTransferDelayHours] = useState(initialConfig.transferDelayHours);

  const inputCls = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50';
  const sectionCls = 'rounded-lg border border-gray-200 bg-white p-5 space-y-4';

  const handleSave = () => {
    startTransition(async () => {
      setSaveResult(null);
      // 1. Save API keys
      const keysPayload: Record<string, string | undefined> = {
        provider: 'stripe',
        testSecretKey: testSecretKey || undefined,
        liveSecretKey: liveSecretKey || undefined,
        testPublishableKey: testPublishableKey || undefined,
        livePublishableKey: livePublishableKey || undefined,
      };
      const keysResult = await updateIntegrationKeys(keysPayload);
      if (keysResult.error) { setSaveResult({ type: 'error', msg: keysResult.error }); return; }

      // 2. Save module toggle
      await toggleIntegrationModule({ moduleKey: 'payments.stripe.enabled', enabled: stripeEnabled });
      await toggleIntegrationModule({ moduleKey: 'payments.stripe.testMode', enabled: testMode });

      // 3. Save payment settings
      await saveGeneralSettings({
        'general.defaultCurrency': defaultCurrency,
      });

      setSaveResult({ type: 'success', msg: 'Settings saved successfully' });
    });
  };

  const handleTestConnection = () => {
    startTransition(async () => {
      setTestResult(null);
      const result = await testStripeConnection();
      setTestResult({ success: result.success ?? false, message: result.message ?? result.error ?? 'Unknown' });
    });
  };

  const Toggle = ({ value, onChange, label, description }: {
    value: boolean; onChange: (v: boolean) => void; label: string; description: string;
  }) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button type="button" disabled={!canEdit} onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${value ? 'bg-purple-600' : 'bg-gray-300'} disabled:opacity-50`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${value ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Module Status */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Module Status</h3>
        <Toggle value={stripeEnabled} onChange={setStripeEnabled}
          label="Enable Stripe Payments" description="When disabled, no payment processing will occur" />
        <div className={`rounded-md p-3 ${testMode ? 'border-2 border-yellow-400 bg-yellow-50' : 'bg-gray-50'}`}>
          <Toggle value={testMode} onChange={setTestMode}
            label="Test Mode Active" description={testMode ? 'Using test API keys — no real charges will occur' : 'Using live API keys — real charges'} />
        </div>
      </div>

      {/* API Keys */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">API Keys</h3>
        <p className="text-xs text-gray-500">
          Get your API keys from{' '}
          <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800">Stripe Dashboard → Developers → API Keys</a>
        </p>

        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-yellow-800">Test API Keys</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Test Secret Key</label>
              <input type="password" value={testSecretKey} onChange={(e) => setTestSecretKey(e.target.value)}
                placeholder={secretMasks.test_secret_key || 'sk_test_...'} disabled={!canEdit} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Test Publishable Key</label>
              <input type="text" value={testPublishableKey} onChange={(e) => setTestPublishableKey(e.target.value)}
                placeholder={secretMasks.test_publishable_key || 'pk_test_...'} disabled={!canEdit} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800">Live API Keys</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Live Secret Key</label>
              <input type="password" value={liveSecretKey} onChange={(e) => setLiveSecretKey(e.target.value)}
                placeholder={secretMasks.live_secret_key || 'sk_live_...'} disabled={!canEdit} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Live Publishable Key</label>
              <input type="text" value={livePublishableKey} onChange={(e) => setLivePublishableKey(e.target.value)}
                placeholder={secretMasks.live_publishable_key || 'pk_live_...'} disabled={!canEdit} className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Webhook Configuration</h3>
        <p className="text-xs text-gray-500">
          Configure webhooks in{' '}
          <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800">Stripe Dashboard → Developers → Webhooks</a>
        </p>

        <div className="rounded-md bg-gray-50 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Webhook Endpoints</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Main:</span>
              <code className="rounded bg-gray-200 px-2 py-0.5 text-gray-800">/api/webhooks/stripe</code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Connect:</span>
              <code className="rounded bg-gray-200 px-2 py-0.5 text-gray-800">/api/webhooks/stripe/connect</code>
            </div>
          </div>
          <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-red-600">Required Events:</p>
            <div className="flex flex-wrap gap-1">
              {['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded',
                'charge.dispute.created', 'charge.dispute.closed', 'account.updated (Connect)',
                'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
                'transfer.created', 'payout.paid', 'payout.failed',
              ].map((evt) => (
                <code key={evt} className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-700">{evt}</code>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Webhook Signing Secret</label>
            <input type="password" value={webhookSigningSecret} onChange={(e) => setWebhookSigningSecret(e.target.value)}
              placeholder={secretMasks.webhook_signing_secret || 'whsec_...'} disabled={!canEdit} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Connect Webhook Secret</label>
            <input type="password" value={connectWebhookSecret} onChange={(e) => setConnectWebhookSecret(e.target.value)}
              placeholder={secretMasks.connect_webhook_secret || 'whsec_...'} disabled={!canEdit} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Payment Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Statement Descriptor <span className="text-gray-400">(max 22 chars)</span></label>
            <input type="text" value={statementDescriptor} maxLength={22} disabled={!canEdit}
              onChange={(e) => setStatementDescriptor(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-400 mt-0.5">Appears on customer bank statements</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Default Currency</label>
            <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}
              disabled={!canEdit} className={inputCls}>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stripe Connect */}
      <div className={sectionCls}>
        <h3 className="text-sm font-semibold text-gray-900">Stripe Connect</h3>
        <p className="text-xs text-gray-500">Configure how seller accounts are created and managed</p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Default Connect Country</label>
          <select value={connectCountry} onChange={(e) => setConnectCountry(e.target.value)}
            disabled={!canEdit} className={`${inputCls} max-w-xs`}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
          </select>
        </div>
        <Toggle value={autoTransfer} onChange={setAutoTransfer}
          label="Auto-Transfer to Sellers" description="Automatically transfer funds when payment succeeds" />
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Transfer Delay (Hours) <span className="text-gray-400">(0 = immediate)</span>
          </label>
          <input type="number" value={transferDelayHours} min={0} max={720} disabled={!canEdit}
            onChange={(e) => setTransferDelayHours(Number(e.target.value))} className={`${inputCls} max-w-[200px]`} />
          <p className="text-xs text-gray-400 mt-0.5">Delay transfers for fraud detection and buyer protection</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={handleTestConnection} disabled={isPending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {isPending ? 'Testing...' : 'Test Connection'}
        </button>
        <button type="button" onClick={handleSave} disabled={isPending || !canEdit}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
          {isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {testResult && (
        <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>{testResult.message}</p>
      )}
      {saveResult && (
        <p className={`text-sm ${saveResult.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{saveResult.msg}</p>
      )}
    </div>
  );
}
