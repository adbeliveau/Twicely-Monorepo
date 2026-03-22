import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByCategory } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { TrustSettingsForm } from '@/components/admin/settings/trust-settings-form';

export const metadata: Metadata = { title: 'Trust Settings | Twicely Hub' };

const TRUST_SETTINGS = [
  { key: 'trust.review.allowSellerResponse', label: 'Allow Seller Responses', description: 'Allow sellers to respond to buyer reviews', type: 'toggle' as const },
  { key: 'trust.review.moderationEnabled', label: 'Review Moderation', description: 'Enable review content moderation before publishing', type: 'toggle' as const },
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
    value: dbValueMap.get(s.key) ?? false,
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
