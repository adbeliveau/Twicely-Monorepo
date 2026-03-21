'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { Label } from '@twicely/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { Input } from '@twicely/ui/input';
import { Loader2, ExternalLink } from 'lucide-react';
import { generateReportAction } from '@/lib/actions/finance-center-reports';
import type { SavedReport } from '@/lib/queries/finance-center-reports';

type ReportType = 'PNL' | 'BALANCE_SHEET' | 'CASH_FLOW';
type ReportFormat = 'JSON' | 'CSV' | 'PDF';

interface ReportGeneratorProps {
  onReportGenerated?: (report: SavedReport) => void;
}

function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === 'last-month') {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    return { start: startDate.toISOString().slice(0, 16), end: endDate.toISOString().slice(0, 16) };
  }
  if (preset === 'last-quarter') {
    const q = Math.floor(month / 3);
    const startDate = new Date(year, (q - 1) * 3, 1);
    const endDate = new Date(year, q * 3, 0, 23, 59, 59);
    return { start: startDate.toISOString().slice(0, 16), end: endDate.toISOString().slice(0, 16) };
  }
  if (preset === 'ytd') {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, month, now.getDate(), 23, 59, 59);
    return { start: startDate.toISOString().slice(0, 16), end: endDate.toISOString().slice(0, 16) };
  }
  if (preset === 'last-year') {
    const startDate = new Date(year - 1, 0, 1);
    const endDate = new Date(year - 1, 11, 31, 23, 59, 59);
    return { start: startDate.toISOString().slice(0, 16), end: endDate.toISOString().slice(0, 16) };
  }
  return { start: '', end: '' };
}

export function ReportGenerator({ onReportGenerated }: ReportGeneratorProps) {
  const [reportType, setReportType] = useState<ReportType>('PNL');
  const [format, setFormat] = useState<ReportFormat>('JSON');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<SavedReport | null>(null);

  function applyPreset(preset: string) {
    const { start, end } = getPresetDates(preset);
    setPeriodStart(start);
    setPeriodEnd(end);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGeneratedReport(null);

    if (!periodStart || !periodEnd) {
      setError('Please select a date range.');
      return;
    }

    setLoading(true);
    try {
      const result = await generateReportAction({
        reportType,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        format,
      });

      if (!result.success) {
        setError(result.error);
      } else {
        setGeneratedReport(result.report);
        onReportGenerated?.(result.report);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Report</CardTitle>
        <CardDescription>
          Create a P&amp;L, balance sheet, or cash flow report for any date range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PNL">P&amp;L Statement</SelectItem>
                  <SelectItem value="BALANCE_SHEET">Balance Sheet</SelectItem>
                  <SelectItem value="CASH_FLOW">Cash Flow Statement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JSON">View Online</SelectItem>
                  <SelectItem value="CSV">CSV Download</SelectItem>
                  <SelectItem value="PDF">Printable Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(['last-month', 'last-quarter', 'ytd', 'last-year'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p)}
                >
                  {p === 'last-month' && 'Last Month'}
                  {p === 'last-quarter' && 'Last Quarter'}
                  {p === 'ytd' && 'Year to Date'}
                  {p === 'last-year' && 'Last Year'}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="datetime-local"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="datetime-local"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {generatedReport && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
              <p className="text-sm font-medium text-green-800">Report generated successfully.</p>
              {generatedReport.format === 'JSON' ? (
                <p className="text-xs text-green-700">View it in the reports list below.</p>
              ) : (
                (() => {
                  const safeUrl = generatedReport.fileUrl?.startsWith('https://') ? generatedReport.fileUrl : undefined;
                  return safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-green-700 underline"
                    >
                      Download file <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null;
                })()
              )}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              'Generate Report'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
