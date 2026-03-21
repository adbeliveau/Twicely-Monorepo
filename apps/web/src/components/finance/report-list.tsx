'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { Loader2, Trash2, Eye, Download, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@twicely/ui/dialog';
import { listReportsAction, deleteReportAction, getReportAction } from '@/lib/actions/finance-center-reports';
import type { SavedReport } from '@/lib/queries/finance-center-reports';
import { formatReportType, formatDateRange, formatReportFormat } from '@twicely/finance/format';
import { ReportViewer } from './report-viewer';

interface ReportListProps {
  refreshTrigger?: number;
}

export function ReportList({ refreshTrigger = 0 }: ReportListProps) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const pageSize = 10;

  const fetchReports = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await listReportsAction({ page: p, pageSize });
      if (result.success) {
        setReports(result.data.reports);
        setTotal(result.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports(page);
  }, [page, refreshTrigger, fetchReports]);

  async function confirmDelete() {
    if (!deletingId) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const result = await deleteReportAction({ id: deletingId });
      if (result.success) {
        setDeletingId(null);
        await fetchReports(page);
      } else {
        setDeleteError(result.error ?? 'Failed to delete');
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleView(id: string) {
    setViewLoading(true);
    try {
      const result = await getReportAction({ id });
      if (result.success) {
        setViewingReport(result.report);
      }
    } finally {
      setViewLoading(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  if (viewingReport) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setViewingReport(null)}>
          &larr; Back to reports
        </Button>
        <ReportViewer report={viewingReport} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Reports</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No reports generated yet. Use the form above to create your first report.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Report Type</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Period</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Format</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Generated</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{formatReportType(r.reportType)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatDateRange(new Date(r.periodStart), new Date(r.periodEnd))}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {formatReportFormat(r.format)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString('en-US')}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.format === 'JSON' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleView(r.id)}
                              disabled={viewLoading}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          ) : (() => {
                            const safeUrl = r.fileUrl?.startsWith('https://') ? r.fileUrl : undefined;
                            return safeUrl ? (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4 mr-1" />
                                  Download
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </Button>
                            ) : null;
                          })()}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => { setDeletingId(r.id); setDeleteError(null); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {total} report{total !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete report</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete this report? This cannot be undone.</p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteLoading}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
