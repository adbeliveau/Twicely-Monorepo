'use client';

import { useState, useTransition } from 'react';
import { Download, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { requestDataExport, downloadDataExport } from '@/lib/actions/data-export';
import type { DataExportRequestRecord } from '@/lib/actions/data-export';

interface Props {
  initialRequests: DataExportRequestRecord[];
  exportFormats: string[];
}

const STATUS_ICON: Record<string, typeof Clock> = {
  PENDING:    Clock,
  PROCESSING: Clock,
  COMPLETED:  CheckCircle,
  FAILED:     XCircle,
  EXPIRED:    XCircle,
};

export function DataExportSection({ initialRequests, exportFormats }: Props) {
  const [requests] = useState<DataExportRequestRecord[]>(initialRequests);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const validFormats = exportFormats.filter((f): f is 'json' | 'csv' =>
    f === 'json' || f === 'csv'
  );

  function handleRequest() {
    startTransition(async () => {
      const result = await requestDataExport({ format });
      if (result.success) {
        setMessage(
          'Your data export is being prepared. We will notify you when it is ready (up to 48 hours).'
        );
      } else {
        setMessage(result.error ?? 'Failed to start export.');
      }
    });
  }

  function handleDownload(requestId: string) {
    startTransition(async () => {
      const result = await downloadDataExport(requestId);
      if (result.success && result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      } else {
        setMessage(result.error ?? 'Download not available.');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" aria-hidden="true" />
          Download My Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Request a copy of all data Twicely holds about you. Exports are prepared
          within 48 hours and the download link expires after 24 hours.
        </p>

        <div className="flex items-center gap-3">
          {validFormats.length > 1 && (
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as 'json' | 'csv')}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                {validFormats.map((f) => (
                  <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleRequest} disabled={isPending} type="button">
            {isPending ? 'Requesting...' : 'Download My Data'}
          </Button>
        </div>

        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}

        {requests.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Previous Requests</p>
            {requests.map((req) => {
              const Icon = STATUS_ICON[req.status] ?? Clock;
              const isExpired =
                req.downloadExpiresAt && new Date(req.downloadExpiresAt) < new Date();
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-medium">{req.format.toUpperCase()} export</span>
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(req.createdAt).toLocaleDateString()} — {req.status}
                      </p>
                    </div>
                  </div>
                  {req.status === 'COMPLETED' && req.downloadUrl && !isExpired && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(req.id)}
                      disabled={isPending}
                      type="button"
                    >
                      Download
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
