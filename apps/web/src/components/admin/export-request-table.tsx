'use client';

import { useState } from 'react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@twicely/ui/table';
import type { ExportRequestRow } from '@/lib/queries/admin-data-exports';

interface ExportRequestTableProps {
  initialRequests: ExportRequestRow[];
  initialTotal: number;
  slaHours: number;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  PROCESSING: 'default',
  COMPLETED: 'default',
  FAILED: 'destructive',
  EXPIRED: 'outline',
};

export function ExportRequestTable({
  initialRequests,
  initialTotal,
  slaHours,
}: ExportRequestTableProps) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page] = useState(1);

  void page;
  void slaHours;

  const now = new Date();

  const filtered = initialRequests.filter((req) => {
    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term.length === 0 ||
      req.userName.toLowerCase().includes(term) ||
      req.userEmail.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Search by user name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No export requests found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((req) => {
                const hasValidDownload =
                  req.downloadUrl !== null &&
                  req.downloadExpiresAt !== null &&
                  new Date(req.downloadExpiresAt) > now;

                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{req.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{req.userName}</p>
                        <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm uppercase">{req.format}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[req.status] ?? 'default'}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.requestedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {req.completedAt ? req.completedAt.toLocaleDateString() : '--'}
                    </TableCell>
                    <TableCell>
                      {hasValidDownload ? (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={req.downloadUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </a>
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {initialTotal} export requests.
      </p>
    </div>
  );
}
