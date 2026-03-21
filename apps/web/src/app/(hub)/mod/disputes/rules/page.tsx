// NAV_ENTRY: Dispute Resolution Rules | /mod/disputes/rules | requires ADMIN
import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSettingsByKeys } from '@/lib/queries/admin-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DisputeRulesForm } from './dispute-rules-form';

export const metadata: Metadata = { title: 'Dispute Resolution Rules | Twicely Hub' };

const DISPUTE_SETTING_KEYS = [
  'protection.standardClaimWindowDays',
  'protection.counterfeitClaimWindowDays',
  'protection.sellerResponseHours',
  'protection.autoApproveOnNonResponse',
  'protection.maxClaimAmountCents',
  'protection.maxRestockingFeePercent',
  'protection.chargebackFeeCents',
  'returns.sellerResponseDays',
  'returns.autoApproveUnderCents',
  'returns.maxReturnsPerBuyerPerMonth',
  'payments.disputeSellerFeeCents',
  'payments.waiveFirstDisputeFee',
];

export default async function DisputeRulesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return <p className="text-red-600">Access denied — ADMIN role required</p>;
  }

  const settings = await getSettingsByKeys(DISPUTE_SETTING_KEYS);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dispute Resolution Rules"
        description="Configure auto-close conditions, claim windows, and escalation thresholds"
      />

      <DisputeRulesForm settings={settings} />
    </div>
  );
}
