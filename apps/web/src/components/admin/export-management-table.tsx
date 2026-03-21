'use client';

/**
 * Export Management Table (I13)
 * Read-only table displaying GDPR data export requests with filters.
 */

import { useState } from 'react';
import { Badge } from '@twicely/ui/badge';
import { Input } from '@twicely/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';
import type { ExportRequestRow } from '@/lib/queries/admin-data-retention-exports';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  PROCESSING: 'default',
  COMPLETED: 'outline',
  FAILED: 'destructive',
  EXPIRED: 'secondary',
};

interface ExportManagementTableProps {
  initialRequests: ExportRequestRow[];
  initialTotal: number;
  slaHours: number;
}

export function ExportManagementTable({
  initialRequests,
  slaHours,
}: ExportManagementTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = initialRequests.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch =
      !search ||
      r.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  function isDownloadActive(row: ExportRequestRow): boolean {
    if (!row.downloadUrl || !row.downloadExpiresAt) return false;
    return row.downloadExpiresAt > new Date();
  }

  function formatDate(d: Date | null): string {
    if (!d) return '--';
    return new Date(d).toLocaleString();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by email, name, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PROCESSING">Processing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          SLA: {slaHours}h
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No export requests found.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <th className="py-2 px-4 text-left">ID</th>
                <th className="py-2 px-4 text-left">User</th>
                <th className="py-2 px-4 text-left">Format</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Requested</th>
                <th className="py-2 px-4 text-left">Completed</th>
                <th className="py-2 px-4 text-left">Download</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                    {row.id.slice(0, 8)}…
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm">{row.userName ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{row.userEmail ?? '—'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{row.format.toUpperCase()}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={STATUS_VARIANTS[row.status] ?? 'default'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {formatDate(row.completedAt)}
                  </td>
                  <td className="py-3 px-4">
                    {isDownloadActive(row) ? (
                      <a
                        href={row.downloadUrl ?? '#'}
                        className="text-xs text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
