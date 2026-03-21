import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTaxComplianceSummary, getSellersNeedingTaxInfo } from '@/lib/queries/tax-compliance';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { TaxComplianceDashboard } from '@/components/hub/tax/tax-compliance-dashboard';

export const metadata: Metadata = { title: 'Tax Compliance | Twicely Hub' };

export default async function TaxCompliancePage() {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'TaxInfo')) {
    return <p className="text-red-600 p-4">Access denied. ADMIN or FINANCE role required.</p>;
  }

  const year = new Date().getFullYear();

  const [summary, sellersNeedingTaxInfo, thresholdCents] = await Promise.all([
    getTaxComplianceSummary(year),
    getSellersNeedingTaxInfo(year),
    getPlatformSetting<number>('tax.1099kThresholdCents', 60000),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tax Compliance"
        description={`IRS 1099-K reporting compliance for ${year}`}
      />
      <TaxComplianceDashboard
        summary={summary}
        sellersNeedingTaxInfo={sellersNeedingTaxInfo}
        year={year}
        thresholdCents={thresholdCents}
      />
    </div>
  );
}
