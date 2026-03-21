import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getExportRequestSummary, getExportRequestList, getExportSlaBreach } from '@/lib/queries/admin-data-exports';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ExportRequestTable } from '@/components/admin/export-request-table';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';

export const metadata: Metadata = {
  title: 'Data Exports | Twicely Hub',
  robots: { index: false, follow: false },
};

export default async function DataExportsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'DataRetention')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const slaHours = await getPlatformSetting<number>('privacy.dataExportMaxHours', 48);

  const [summary, slaBreach, requestData] = await Promise.all([
    getExportRequestSummary(),
    getExportSlaBreach(slaHours),
    getExportRequestList({ page: 1, pageSize: 50 }),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Data Exports"
        description="Monitor and manage GDPR data export requests."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.pending}</p>
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

      {/* SLA info card */}
      <Card className={slaBreach > 0 ? 'border-destructive' : ''}>
        <CardContent className="pt-4">
          {slaBreach > 0 ? (
            <p className="text-sm text-destructive font-medium">
              {slaBreach} export{slaBreach !== 1 ? 's are' : ' is'} overdue.
              Exports should complete within {slaHours} hours.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No overdue exports. SLA: {slaHours} hours.
            </p>
          )}
        </CardContent>
      </Card>

      <ExportRequestTable
        initialRequests={requestData.requests}
        initialTotal={requestData.total}
        slaHours={slaHours}
      />
    </div>
  );
}
