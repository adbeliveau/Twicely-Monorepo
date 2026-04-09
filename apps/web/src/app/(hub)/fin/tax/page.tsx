import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTaxComplianceSummary, getSellersNeedingTaxInfo } from '@/lib/queries/tax-compliance';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getTaxDocumentById } from '@/lib/queries/tax-documents';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { TaxComplianceDashboard } from '@/components/hub/tax/tax-compliance-dashboard';

export const metadata: Metadata = { title: 'Tax Compliance | Twicely Hub' };

export default async function TaxCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; userId?: string }>;
}) {
  const { ability } = await staffAuthorize();

  if (!ability.can('read', 'TaxInfo')) {
    return <p className="text-red-600 p-4">Access denied. ADMIN or FINANCE role required.</p>;
  }

  const year = new Date().getFullYear();
  const params = await searchParams;

  const [summary, sellersNeedingTaxInfo, thresholdCents, focusedDoc] = await Promise.all([
    getTaxComplianceSummary(year),
    getSellersNeedingTaxInfo(year),
    getPlatformSetting<number>('tax.1099kThresholdCents', 60000),
    params.doc && params.userId
      ? getTaxDocumentById(params.doc, params.userId)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tax Compliance"
        description={`IRS 1099-K reporting compliance for ${year}`}
      />
      {focusedDoc && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Tax Document</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-gray-500">Report Type</dt>
              <dd className="font-medium text-gray-900">{focusedDoc.reportType}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Tax Year</dt>
              <dd className="font-medium text-gray-900">{focusedDoc.taxYear}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Period</dt>
              <dd className="font-medium text-gray-900">
                {focusedDoc.periodStart.toLocaleDateString()} – {focusedDoc.periodEnd.toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Format</dt>
              <dd className="font-medium text-gray-900">{focusedDoc.format}</dd>
            </div>
            <div>
              <dt className="text-gray-500">File</dt>
              <dd>
                {focusedDoc.fileUrl ? (
                  <a href={focusedDoc.fileUrl} className="text-primary hover:underline text-sm">
                    Download
                  </a>
                ) : (
                  <span className="font-medium text-gray-900">Not generated</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <TaxComplianceDashboard
        summary={summary}
        sellersNeedingTaxInfo={sellersNeedingTaxInfo}
        year={year}
        thresholdCents={thresholdCents}
      />
    </div>
  );
}
