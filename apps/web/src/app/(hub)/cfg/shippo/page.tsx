import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdapterByCode, getInstancesByAdapter, getInstanceSecrets } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ProviderInstanceForm } from '@/components/admin/settings/provider-instance-form';
import type { ConfigField } from '@/components/admin/settings/provider-config-form';
import { decryptSecret, maskSecret } from '@/lib/crypto/provider-secrets';
import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import { inArray } from 'drizzle-orm';
import Link from 'next/link';
import { ShippoFulfillmentSummary } from '@/components/admin/settings/shippo-fulfillment-summary';

export const metadata: Metadata = { title: 'Shippo Settings | Twicely Hub' };

const SHIPPO_WEBHOOK_EVENTS = [
  'track_updated', 'transaction_created', 'transaction_updated',
  'batch_created', 'batch_purchased',
];

const FULFILLMENT_KEYS = [
  'fulfillment.shipping.defaultHandlingDays', 'fulfillment.shipping.maxHandlingDays',
  'fulfillment.shipping.trackingRequiredAboveCents', 'fulfillment.shipping.signatureRequiredAboveCents',
  'fulfillment.shipping.defaultCarrier', 'fulfillment.shipping.labelGenerationEnabled',
  'fulfillment.insurance.autoInsureAboveCents', 'fulfillment.returns.windowDays',
];

export default async function ShippoSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderAdapter')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [adapter, fulfillmentRows] = await Promise.all([
    getAdapterByCode('shippo'),
    db.select({ key: platformSetting.key, value: platformSetting.value })
      .from(platformSetting)
      .where(inArray(platformSetting.key, FULFILLMENT_KEYS)),
  ]);

  const fm = new Map<string, unknown>(fulfillmentRows.map((r) => [r.key, r.value]));
  const fulfillmentSettings = {
    defaultHandlingDays: Number(fm.get('fulfillment.shipping.defaultHandlingDays') ?? 3),
    maxHandlingDays: Number(fm.get('fulfillment.shipping.maxHandlingDays') ?? 7),
    trackingRequiredAboveCents: Number(fm.get('fulfillment.shipping.trackingRequiredAboveCents') ?? 5000),
    signatureRequiredAboveCents: Number(fm.get('fulfillment.shipping.signatureRequiredAboveCents') ?? 75000),
    defaultCarrier: String(fm.get('fulfillment.shipping.defaultCarrier') ?? 'USPS'),
    labelGenerationEnabled: fm.get('fulfillment.shipping.labelGenerationEnabled') !== false,
    autoInsureAboveCents: Number(fm.get('fulfillment.insurance.autoInsureAboveCents') ?? 10000),
    returnsWindowDays: Number(fm.get('fulfillment.returns.windowDays') ?? 30),
  };

  if (!adapter) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="Shippo" description="Shipping provider configuration" />
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            Shippo adapter not found. Run <code className="rounded bg-yellow-100 px-1">pnpm db:seed</code> to register built-in providers.
          </p>
        </div>
        <ShippoFulfillmentSummary settings={fulfillmentSettings} />
      </div>
    );
  }

  const instances = await getInstancesByAdapter(adapter.id);
  const instance = instances[0];
  const schema = (adapter.configSchemaJson ?? []) as ConfigField[];

  let configJson: Record<string, unknown> = {};
  const secretMasks: Record<string, string> = {};

  if (instance) {
    configJson = (instance.configJson ?? {}) as Record<string, unknown>;
    const rawSecrets = await getInstanceSecrets(instance.id);
    for (const s of rawSecrets) {
      try { secretMasks[s.key] = maskSecret(decryptSecret(s.encryptedValue)); }
      catch { secretMasks[s.key] = '••••••••'; }
    }
  }

  const canEdit = ability.can('update', 'ProviderInstance');

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Shippo Settings" description="Multi-carrier shipping rates, label generation, and tracking" />

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg/providers" className="hover:text-gray-700">Providers</Link>
        <span>/</span>
        <span className="text-gray-900">Shippo</span>
      </div>

      <ShippoFulfillmentSummary settings={fulfillmentSettings} />

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {instance ? (
          <ProviderInstanceForm mode="edit" adapterId={adapter.id} adapterName="Shippo"
            configSchema={schema} instanceId={instance.id} initialName={instance.name}
            initialDisplayName={instance.displayName} initialConfig={configJson}
            secretMasks={secretMasks} canEdit={canEdit} />
        ) : (
          <ProviderInstanceForm mode="create" adapterId={adapter.id} adapterName="Shippo"
            configSchema={schema} canEdit={canEdit} />
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-primary">Webhook Configuration</h3>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Webhook URL</label>
          <code className="block rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-800">
            https://twicely.co/api/webhooks/shippo
          </code>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-gray-700">Required Events</p>
          <div className="flex flex-wrap gap-1">
            {SHIPPO_WEBHOOK_EVENTS.map((evt) => (
              <code key={evt} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{evt}</code>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-primary">Label Settings</h3>
        <p className="mt-1 text-xs text-gray-500">
          Default label format: 4x6 thermal (PNG). Configure custom formats in the Shippo Dashboard.
        </p>
      </div>

      <p className="text-xs text-gray-400">
        See{' '}
        <a href="https://goshippo.com/docs/" target="_blank" rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800">Shippo documentation</a>{' '}
        for API token setup. Enable test mode during development.
      </p>
    </div>
  );
}
