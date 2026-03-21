import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByCategory } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { TrustSettingsForm } from '@/components/admin/settings/trust-settings-form';

export const metadata: Metadata = { title: 'Trust Settings | Twicely Hub' };

const TRUST_SETTINGS = [
  { key: 'trust.autoModeration.enabled', label: 'Auto-Moderation', description: 'Automatically flag listings that match moderation rules', type: 'toggle' as const },
  { key: 'trust.fraudDetection.enabled', label: 'Fraud Detection', description: 'Enable automated fraud scoring on new accounts and orders', type: 'toggle' as const },
  { key: 'trust.identityVerification.required', label: 'Identity Verification', description: 'Require identity verification for Business sellers', type: 'toggle' as const },
  { key: 'trust.disputeAutoEscalation.enabled', label: 'Auto-Escalate Disputes', description: 'Automatically escalate disputes after 48h without response', type: 'toggle' as const },
  { key: 'trust.fraudDetection.level', label: 'Fraud Sensitivity', description: 'How aggressively to flag potential fraud', type: 'select' as const, options: [
    { label: 'Low', value: 'LOW' },
    { label: 'Medium', value: 'MEDIUM' },
    { label: 'High', value: 'HIGH' },
  ]},
  { key: 'trust.newAccountRestriction.enabled', label: 'New Account Restrictions', description: 'Limit new accounts to 5 listings/day for first 30 days', type: 'toggle' as const },
  { key: 'trust.suspiciousActivity.autoSuspend', label: 'Auto-Suspend on Suspicious Activity', description: 'Automatically suspend accounts flagged for suspicious behavior', type: 'toggle' as const },
];

export default async function TrustSettingsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const grouped = await getSettingsByCategory();
  const trustSettings = grouped['trust'] ?? [];

  // Merge DB values into the static settings definition
  const dbValueMap = new Map(trustSettings.map((s) => [s.key, s.value]));
  const mergedSettings = TRUST_SETTINGS.map((s) => ({
    ...s,
    value: dbValueMap.get(s.key) ?? (s.type === 'toggle' ? false : s.options?.[0]?.value ?? ''),
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Trust & Safety"
        description="Configure auto-moderation, fraud detection, verification, and dispute thresholds"
      />
      <TrustSettingsForm settings={mergedSettings} canEdit={canEdit} />
    </div>
  );
}
