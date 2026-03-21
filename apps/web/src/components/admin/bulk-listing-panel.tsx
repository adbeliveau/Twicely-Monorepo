'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { Checkbox } from '@twicely/ui/checkbox';
import { Input } from '@twicely/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@twicely/ui/table';
import type { BulkListingRow, BulkListingSummary } from '@/lib/queries/admin-data-bulk';
import { bulkUpdateListingStatusAction } from '@/lib/actions/admin-data-management';

interface BulkListingPanelProps {
  initialListings: BulkListingRow[];
  initialTotal: number;
  summary: BulkListingSummary;
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DRAFT: 'outline',
  ENDED: 'outline',
  REMOVED: 'destructive',
  SOLD: 'secondary',
};

export function BulkListingPanel({
  initialListings,
  initialTotal,
  summary,
}: BulkListingPanelProps) {
  const [listings] = useState<BulkListingRow[]>(initialListings);
  const [total] = useState<number>(initialTotal);
  const [search, setSearch] = useState('');
  const [statusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  void summary;
  void statusFilter;
  void search;

  const allIds = listings.map((l) => l.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function handleBulkAction(targetStatus: 'ACTIVE' | 'PAUSED' | 'ENDED' | 'REMOVED') {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await bulkUpdateListingStatusAction({
        listingIds: Array.from(selectedIds),
        targetStatus,
      });
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: `${selectedIds.size} listing(s) updated to ${targetStatus}.` });
        setSelectedIds(new Set());
      }
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Listings</h2>
      <p className="text-sm text-gray-500">{total} total listings</p>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search by title or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-sm font-medium text-gray-700">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleBulkAction('ACTIVE')}
          >
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleBulkAction('PAUSED')}
          >
            Pause
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleBulkAction('REMOVED')}
          >
            Remove
          </Button>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={[
            'rounded-md px-4 py-3 text-sm',
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200',
          ].join(' ')}
          role="alert"
        >
          {message.text}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No listings found.
                </TableCell>
              </TableRow>
            ) : (
              listings.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(l.id)}
                      onCheckedChange={() => toggleOne(l.id)}
                      aria-label={`Select listing ${l.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.id.slice(0, 8)}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {l.title ?? '(untitled)'}
                  </TableCell>
                  <TableCell className="text-sm">{l.sellerName}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[l.status] ?? 'default'}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.priceCents != null
                      ? `$${(l.priceCents / 100).toFixed(2)}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
