'use client';

import type { TaxComplianceSummary, SellerTaxRow } from '@/lib/queries/tax-compliance';
import { StatCard } from '@/components/admin/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { AlertTriangle, CheckCircle, FileText, Users } from 'lucide-react';

interface TaxComplianceDashboardProps {
  summary: TaxComplianceSummary;
  sellersNeedingTaxInfo: SellerTaxRow[];
  year: number;
  thresholdCents: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function TaxComplianceDashboard({
  summary,
  sellersNeedingTaxInfo,
  year,
  thresholdCents,
}: TaxComplianceDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Sellers approaching threshold"
          value={String(summary.sellersApproachingThreshold)}
          icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
        />
        <StatCard
          label={`Sellers over ${formatCents(thresholdCents)} threshold`}
          value={String(summary.sellersOverThreshold)}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        />
        <StatCard
          label="Tax info provided"
          value={String(summary.sellersWithTaxInfo)}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
        />
        <StatCard
          label="Missing tax info"
          value={String(summary.sellersMissingTaxInfo)}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={`1099-K documents (${year})`}
          value={String(summary.docs1099KGenerated)}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Affiliates over 1099-NEC threshold"
          value={String(summary.affiliatesOverNecThreshold)}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Sellers table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sellers Over {formatCents(thresholdCents)} Threshold
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sellersNeedingTaxInfo.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sellers currently over threshold.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">YTD Gross</th>
                    <th className="pb-2 pr-4">Tax Info</th>
                    <th className="pb-2 pr-4">Masked TIN</th>
                    <th className="pb-2">1099-K</th>
                  </tr>
                </thead>
                <tbody>
                  {sellersNeedingTaxInfo.map((row) => (
                    <tr key={row.userId} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{row.email}</td>
                      <td className="py-2 pr-4">{formatCents(row.ytdGrossCents)}</td>
                      <td className="py-2 pr-4">
                        {row.taxInfoProvided ? (
                          <Badge variant="default" className="text-xs">Provided</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Missing</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.maskedTaxId ?? '—'}
                      </td>
                      <td className="py-2">
                        {row.doc1099KGenerated ? (
                          <Badge variant="outline" className="text-xs">Generated</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tax IDs are shown masked (last 4 digits only). Full SSN/EIN is never displayed.
        Official 1099 forms are filed electronically by Twicely through Stripe.
      </p>
    </div>
  );
}
