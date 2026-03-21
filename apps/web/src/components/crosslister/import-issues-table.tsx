'use client';

/**
 * Table of failed import records with retry buttons.
 * Source: F1.3 install prompt §2.9 Page 4
 */

import { Button } from '@twicely/ui/button';
import { ExternalLink } from 'lucide-react';
import { retryImportRecord } from '@/lib/actions/crosslister-import';
import { useState, useTransition } from 'react';
import type { ImportRecord } from '@twicely/crosslister/db-types';

interface ImportIssuesTableProps {
  records: ImportRecord[];
}

interface RecordState {
  status: 'idle' | 'retrying' | 'retried';
  error?: string;
}

export function ImportIssuesTable({ records }: ImportIssuesTableProps) {
  const [states, setStates] = useState<Record<string, RecordState>>({});
  const [isPending, startTransition] = useTransition();

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">No issues to display.</p>
    );
  }

  const handleRetry = (recordId: string) => {
    setStates((prev) => ({ ...prev, [recordId]: { status: 'retrying' } }));
    startTransition(async () => {
      const result = await retryImportRecord({ recordId });
      setStates((prev) => ({
        ...prev,
        [recordId]: result.success
          ? { status: 'retried' }
          : { status: 'idle', error: result.error },
      }));
    });
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Error</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const raw = record.rawDataJson as { title?: string; url?: string } | null;
            const title = raw?.title ?? record.externalId;
            const url = raw?.url;
            const state = states[record.id] ?? { status: 'idle' };

            return (
              <tr key={record.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium max-w-[200px] truncate">{title}</span>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{record.externalId}</p>
                </td>
                <td className="px-4 py-3 text-red-600 text-xs max-w-[200px]">
                  {record.errorMessage ?? 'Unknown error'}
                  {state.error && <span className="block text-red-500 mt-1">{state.error}</span>}
                </td>
                <td className="px-4 py-3">
                  {state.status === 'retried' ? (
                    <span className="text-green-600 text-xs font-medium">Retried</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(record.id)}
                      disabled={isPending || state.status === 'retrying'}
                    >
                      {state.status === 'retrying' ? 'Retrying...' : 'Retry'}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
