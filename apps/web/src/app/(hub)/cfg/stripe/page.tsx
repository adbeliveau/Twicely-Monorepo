import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAdapterByCode, getInstancesByAdapter, getInstanceSecrets } from '@/lib/queries/admin-providers';
import { getRecentAuditEvents } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { maskSecret, decryptSecret } from '@/lib/crypto/provider-secrets';
import { db } from '@twicely/db';
import { platformSetting } from '@twicely/db/schema';
import Link from 'next/link';
import { StripeSettingsForm } from './stripe-settings-form';
import { StripeCostSummary } from '@/components/admin/settings/stripe-cost-summary';

export const metadata: Metadata = { title: 'Stripe Payment Settings | Twicely Hub' };

const STRIPE_FEE_KEYS = [
  { key: 'stripe.activeAccountFeeCents', label: 'Active Account Fee', type: 'cents' as const },
  { key: 'stripe.payoutFixedCents', label: 'Payout Fixed Fee', type: 'cents' as const },
  { key: 'stripe.payoutPercentBps', label: 'Payout Percentage', type: 'bps' as const },
  { key: 'stripe.fundsRoutingBps', label: 'Funds Routing Fee', type: 'bps' as const },
  { key: 'stripe.instantPayoutBps', label: 'Instant Payout Rate', type: 'bps' as const },
  { key: 'stripe.subscriptionBillingBps', label: 'Subscription Billing', type: 'bps' as const },
  { key: 'stripe.irsEfileCents', label: 'IRS E-File Fee', type: 'cents' as const },
  { key: 'stripe.stateEfileCents', label: 'State E-File Fee', type: 'cents' as const },
];

async function getStripeSettings() {
  const allRows = await db
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting);

  const map = new Map<string, unknown>(allRows.map((r) => [r.key, r.value]));

  return {
    stripeEnabled: map.get('payments.stripe.enabled') !== false,
    testMode: map.get('payments.stripe.testMode') === true,
    statementDescriptor: String(map.get('payments.stripe.statementDescriptor') ?? 'TWICELY'),
    defaultCurrency: String(map.get('general.defaultCurrency') ?? 'USD'),
    connectCountry: String(map.get('payments.stripe.connectCountry') ?? 'US'),
    autoTransfer: map.get('payments.stripe.autoTransfer') !== false,
    transferDelayHours: Number(map.get('payments.stripe.transferDelayHours') ?? 0),
    feeMap: map,
  };
}

export default async function StripeSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderAdapter')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [adapter, stripeConfigRaw, recentEvents] = await Promise.all([
    getAdapterByCode('stripe'),
    getStripeSettings(),
    getRecentAuditEvents({ actionPrefix: 'ProviderInstance', limit: 5 }),
  ]);

  const { feeMap, ...stripeConfig } = stripeConfigRaw;

  // Fetch secret masks from provider instance
  const secretMasks: Record<string, string> = {};
  if (adapter) {
    const instances = await getInstancesByAdapter(adapter.id);
    const instance = instances[0];
    if (instance) {
      const rawSecrets = await getInstanceSecrets(instance.id);
      for (const s of rawSecrets) {
        try { secretMasks[s.key] = maskSecret(decryptSecret(s.encryptedValue)); }
        catch { secretMasks[s.key] = '••••••••'; }
      }
    }
  }

  const canEdit = ability.can('update', 'ProviderInstance');

  const feeSettings = STRIPE_FEE_KEYS.map((def) => ({
    label: def.label,
    value: feeMap.get(def.key) ?? 0,
    type: def.type,
  }));

  const connectionStatus = !adapter
    ? ('not_configured' as const)
    : stripeConfig.testMode
    ? ('test_mode' as const)
    : ('connected' as const);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Stripe Payment Settings"
          description="Configure Stripe API keys, webhooks, and Connect settings"
        />
        <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Open Stripe Dashboard
        </a>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/cfg" className="hover:text-gray-700">Settings</Link>
        <span>/</span>
        <Link href="/cfg/stripe" className="text-gray-900">Stripe Payments</Link>
      </div>

      <StripeCostSummary
        settings={feeSettings}
        connectionStatus={connectionStatus}
        recentEvents={recentEvents.map((e) => ({
          id: e.id,
          action: e.action,
          actorId: e.actorId,
          severity: e.severity,
          createdAt: e.createdAt,
        }))}
      />

      <StripeSettingsForm
        initialConfig={stripeConfig}
        secretMasks={secretMasks}
        canEdit={canEdit}
      />
    </div>
  );
}
