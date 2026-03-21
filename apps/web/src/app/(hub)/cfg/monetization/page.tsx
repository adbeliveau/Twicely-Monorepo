import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getMonetizationOverview } from '@/lib/queries/admin-monetization';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { MonetizationFeeGrid } from '@/components/admin/settings/monetization-fee-grid';
import { PayoutSettingsCards } from '@/components/admin/settings/payout-settings-cards';

export const metadata: Metadata = { title: 'Monetization | Twicely Hub' };

export default async function MonetizationPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Setting')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const canEdit = ability.can('update', 'Setting');
  const overview = await getMonetizationOverview();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Monetization"
        description="Transaction fee schedule, payout settings, and subscription pricing"
      />

      <MonetizationFeeGrid
        brackets={overview.tfBrackets}
        minimumTfCents={overview.minimumTfCents}
        minimumTfSettingId={overview.minimumTfSettingId}
        canEdit={canEdit}
      />

      <PayoutSettingsCards
        escrowHoldHours={overview.escrowHoldHours}
        escrowSettingId={overview.escrowSettingId}
        minimumPayoutCents={overview.minimumPayoutCents}
        payoutSettingId={overview.payoutSettingId}
        instantPayoutFeeCents={overview.instantPayoutFeeCents}
        instantFeeSettingId={overview.instantFeeSettingId}
        canEdit={canEdit}
      />
    </div>
  );
}
