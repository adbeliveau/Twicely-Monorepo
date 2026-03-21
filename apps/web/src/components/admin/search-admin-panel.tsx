'use client';

import { useState, useTransition } from 'react';
import { rebuildSearchIndexAction } from '@/lib/actions/admin-search';
import type { TypesenseStatus } from '@/lib/queries/admin-search';
import { Badge } from '@twicely/ui/badge';

interface SearchAdminPanelProps {
  status: TypesenseStatus;
  canRebuild: boolean;
}

export function SearchAdminPanel({ status, canRebuild }: SearchAdminPanelProps) {
  const [rebuildStatus, setRebuildStatus] = useState<Record<string, 'idle' | 'done' | 'error'>>({});
  const [isPending, startTransition] = useTransition();

  function handleRebuild(collectionName: string) {
    startTransition(async () => {
      const result = await rebuildSearchIndexAction(collectionName);
      if ('error' in result) {
        setRebuildStatus((prev) => ({ ...prev, [collectionName]: 'error' }));
      } else {
        setRebuildStatus((prev) => ({ ...prev, [collectionName]: 'done' }));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Connection status ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Connection Status</h2>
        <div className="flex items-center gap-3">
          <Badge variant={status.connected ? 'default' : 'destructive'}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </Badge>
          {status.latencyMs !== null && (
            <span className="text-xs text-gray-500">{status.latencyMs}ms</span>
          )}
        </div>
        {status.error && (
          <p className="text-xs text-red-600">{status.error}</p>
        )}
      </div>

      {/* ── Collections ─────────────────────────────────────────────────── */}
      {status.connected && status.collections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Collections</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Collection</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Documents</th>
                  {canRebuild && (
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {status.collections.map((col) => {
                  const colStatus = rebuildStatus[col.name] ?? 'idle';
                  return (
                    <tr key={col.name}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-800">{col.name}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {col.numDocuments.toLocaleString()}
                      </td>
                      {canRebuild && (
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleRebuild(col.name)}
                            disabled={isPending || colStatus === 'done'}
                            className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            {colStatus === 'done' ? 'Queued' : 'Rebuild'}
                          </button>
                          {colStatus === 'error' && (
                            <span className="ml-2 text-xs text-red-600">Failed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {status.connected && status.collections.length === 0 && (
        <p className="text-sm text-gray-500 py-2">No collections found.</p>
      )}
    </div>
  );
}
