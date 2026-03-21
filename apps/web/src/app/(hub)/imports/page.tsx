import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getImportBatchSummary, getImportBatchList, getImportHealthStats } from '@/lib/queries/admin-data-imports';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ImportBatchTable } from '@/components/admin/import-batch-table';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Import Batches | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function ImportBatchesPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [summary, healthStats, batchData] = await Promise.all([
    getImportBatchSummary(),
    getImportHealthStats(),
    getImportBatchList({ page: 1, pageSize: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Import Batches"
        description="Monitor crosslister import batches across all sellers and channels."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.failed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Health stats card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-8 text-sm">
            <div>
              <p className="text-muted-foreground">Avg Completion</p>
              <p className="font-semibold">
                {healthStats.avgCompletionMs != null
                  ? `${Math.round(healthStats.avgCompletionMs / 1000)}s`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Success Rate</p>
              <p className="font-semibold">
                {healthStats.successRatePercent != null
                  ? `${healthStats.successRatePercent}%`
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportBatchTable
        initialBatches={batchData.batches}
        initialTotal={batchData.total}
        healthStats={healthStats}
      />
    </div>
  );
}
