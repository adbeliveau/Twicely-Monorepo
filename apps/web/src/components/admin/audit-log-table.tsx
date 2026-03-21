'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AuditEventRow } from '@/lib/queries/admin-audit-log';

const SEVERITY_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'outline',
  CRITICAL: 'destructive',
};

interface AuditLogTableProps {
  events: AuditEventRow[];
  totalCount: number;
  page: number;
  limit: number;
}

export function AuditLogTable({ events, totalCount, page, limit }: AuditLogTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalPages = Math.ceil(totalCount / limit);

  function navigate(newPage: number) {
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(newPage));
    router.push(`/audit?${params.toString()}`);
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        No audit events recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              <th className="py-2 px-3 w-8" />
              <th className="py-2 px-3 text-left">Timestamp</th>
              <th className="py-2 px-3 text-left">Actor</th>
              <th className="py-2 px-3 text-left">Action</th>
              <th className="py-2 px-3 text-left">Subject</th>
              <th className="py-2 px-3 text-left">Severity</th>
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => {
              const isExpanded = expandedId === evt.id;
              return (
                <tr key={evt.id} className="border-b last:border-0">
                  <td colSpan={6} className="p-0">
                    <div
                      className="flex items-center cursor-pointer hover:bg-gray-50 py-3 px-3"
                      onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                    >
                      <div className="w-8 shrink-0">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-gray-400" />
                          : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(evt.createdAt).toLocaleString('en-US')}
                        </span>
                        <span className="text-xs">
                          <span className="text-muted-foreground">{evt.actorType}</span>
                          {evt.actorId && (
                            <span className="ml-1 font-mono text-[10px]">
                              {evt.actorId.slice(0, 8)}...
                            </span>
                          )}
                        </span>
                        <span className="font-medium">{evt.action}</span>
                        <span>
                          {evt.subject}
                          {evt.subjectId && (
                            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                              {evt.subjectId.slice(0, 8)}
                            </span>
                          )}
                        </span>
                        <Badge variant={SEVERITY_COLORS[evt.severity] ?? 'secondary'}>
                          {evt.severity}
                        </Badge>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-11 pb-3">
                        <pre className="text-xs bg-gray-100 rounded p-3 overflow-x-auto max-h-48">
                          {JSON.stringify(evt.detailsJson, null, 2)}
                        </pre>
                        {evt.ipAddress && (
                          <p className="text-xs text-muted-foreground mt-1">IP: {evt.ipAddress}</p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {totalCount} event{totalCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
