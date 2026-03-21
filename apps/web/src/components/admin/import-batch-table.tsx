'use client';

import { useState } from 'react';
import { Badge } from '@twicely/ui/badge';
import { Input } from '@twicely/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@twicely/ui/table';
import type { ImportBatchRow, ImportHealthStats } from '@/lib/queries/admin-data-imports';

interface ImportBatchTableProps {
  initialBatches: ImportBatchRow[];
  initialTotal: number;
  healthStats: ImportHealthStats;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  CREATED: 'secondary',
  FETCHING: 'secondary',
  DEDUPLICATING: 'secondary',
  TRANSFORMING: 'secondary',
  IMPORTING: 'default',
  COMPLETED: 'default',
  FAILED: 'destructive',
  PARTIALLY_COMPLETED: 'outline',
};

export function ImportBatchTable({
  initialBatches,
  initialTotal,
  healthStats,
}: ImportBatchTableProps) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  void page;
  void healthStats;

  function toggleExpanded(id: string) {
    const next = new Set(expandedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedRows(next);
  }

  const filtered = initialBatches.filter((b) => {
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchesChannel = channelFilter === 'ALL' || b.channel === channelFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term.length === 0 ||
      b.sellerName.toLowerCase().includes(term) ||
      b.id.toLowerCase().includes(term);
    return matchesStatus && matchesChannel && matchesSearch;
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
              <SelectItem value="CREATED">Created</SelectItem>
              <SelectItem value="FETCHING">Fetching</SelectItem>
              <SelectItem value="IMPORTING">Importing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="PARTIALLY_COMPLETED">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Channels</SelectItem>
              <SelectItem value="EBAY">eBay</SelectItem>
              <SelectItem value="POSHMARK">Poshmark</SelectItem>
              <SelectItem value="MERCARI">Mercari</SelectItem>
              <SelectItem value="DEPOP">Depop</SelectItem>
              <SelectItem value="ETSY">Etsy</SelectItem>
              <SelectItem value="GRAILED">Grailed</SelectItem>
              <SelectItem value="THEREALREAL">The RealReal</SelectItem>
              <SelectItem value="WHATNOT">Whatnot</SelectItem>
              <SelectItem value="SHOPIFY">Shopify</SelectItem>
              <SelectItem value="VESTIAIRE">Vestiaire</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Search by seller or batch ID"
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
              <TableHead>Batch ID</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No import batches found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.flatMap((b) => {
                const isExpanded = expandedRows.has(b.id);
                return [
                  <TableRow
                    key={b.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpanded(b.id)}
                  >
                    <TableCell className="font-mono text-xs">{b.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{b.sellerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[b.status] ?? 'default'}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{b.totalItems}</TableCell>
                    <TableCell className="text-right text-sm">{b.createdItems}</TableCell>
                    <TableCell className="text-right text-sm">{b.failedItems}</TableCell>
                    <TableCell className="text-sm">
                      {b.startedAt ? b.startedAt.toLocaleDateString() : '--'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.completedAt ? b.completedAt.toLocaleDateString() : '--'}
                    </TableCell>
                  </TableRow>,
                  ...(isExpanded
                    ? [
                        <TableRow key={`${b.id}-expanded`} className="bg-gray-50">
                          <TableCell colSpan={9}>
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all p-2 max-h-48 overflow-y-auto">
                              {JSON.stringify(b.errorSummaryJson, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>,
                      ]
                    : []),
                ];
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {initialTotal} import batches.
      </p>
    </div>
  );
}
