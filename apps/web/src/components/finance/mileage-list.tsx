'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@twicely/ui/dialog';
import { formatCentsToDollars } from '@twicely/finance/format';
import { listMileageAction, deleteMileageAction } from '@/lib/actions/finance-center-mileage';
import { MileageForm } from './mileage-form';
import type { MileageRow, MileageListResult } from '@/lib/queries/finance-center-mileage';

interface MileageListProps {
  initialData: MileageListResult;
  irsRate: number;
}

type SortBy = 'tripDate' | 'miles' | 'deductionCents' | 'createdAt';
type SortOrder = 'asc' | 'desc';

function SortIndicator({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return null;
  return <span>{order === 'asc' ? ' ↑' : ' ↓'}</span>;
}

export function MileageList({ initialData, irsRate }: MileageListProps) {
  const [data, setData] = useState<MileageListResult>(initialData);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('tripDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MileageRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  async function load(
    nextPage: number,
    overrides?: { sortBy?: SortBy; sortOrder?: SortOrder },
  ) {
    setLoading(true);
    const result = await listMileageAction({
      page: nextPage,
      pageSize: initialData.pageSize,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sortBy: overrides?.sortBy ?? sortBy,
      sortOrder: overrides?.sortOrder ?? sortOrder,
    });
    if (result.success) { setData(result.data); setPage(nextPage); }
    setLoading(false);
  }

  function handleSortToggle(col: SortBy) {
    const newOrder = sortBy === col && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(col);
    setSortOrder(newOrder);
    void load(1, { sortBy: col, sortOrder: newOrder });
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteError(null);
    setDeleteLoading(true);
    const result = await deleteMileageAction({ id: deletingId });
    setDeleteLoading(false);
    if (!result.success) { setDeleteError(result.error); return; }
    setDeletingId(null);
    void load(page);
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="filter-start">From</Label>
          <Input
            id="filter-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-end">To</Label>
          <Input
            id="filter-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button variant="outline" onClick={() => void load(1)} disabled={loading}>
          Apply
        </Button>
        <Button onClick={() => setShowForm(true)}>Log Trip</Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th
                className="px-4 py-2 text-left font-medium cursor-pointer hover:bg-muted"
                onClick={() => handleSortToggle('tripDate')}
              >
                Date<SortIndicator active={sortBy === 'tripDate'} order={sortOrder} />
              </th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th
                className="px-4 py-2 text-right font-medium cursor-pointer hover:bg-muted"
                onClick={() => handleSortToggle('miles')}
              >
                Miles<SortIndicator active={sortBy === 'miles'} order={sortOrder} />
              </th>
              <th
                className="px-4 py-2 text-right font-medium cursor-pointer hover:bg-muted"
                onClick={() => handleSortToggle('deductionCents')}
              >
                Deduction<SortIndicator active={sortBy === 'deductionCents'} order={sortOrder} />
              </th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No trips logged yet.
                </td>
              </tr>
            ) : data.entries.map((entry) => (
              <tr key={entry.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.tripDate)}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                  {entry.description.length > 60
                    ? `${entry.description.slice(0, 60)}...`
                    : entry.description}
                </td>
                <td className="px-4 py-3 text-right">{entry.miles.toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCentsToDollars(entry.deductionCents)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEntry(entry)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => { setDeletingId(entry.id); setDeleteError(null); }}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.total === 0
            ? 'No trips'
            : `Page ${page} of ${totalPages} (${data.total} total)`}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => void load(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => void load(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Add trip dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Trip</DialogTitle></DialogHeader>
          <MileageForm
            irsRate={irsRate}
            onSuccess={() => { setShowForm(false); void load(page); }}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Trip</DialogTitle></DialogHeader>
          {editingEntry && (
            <MileageForm
              entry={editingEntry}
              irsRate={irsRate}
              onSuccess={() => { setEditingEntry(null); void load(page); }}
              onCancel={() => setEditingEntry(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete trip</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete this trip entry? This cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeletingId(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
