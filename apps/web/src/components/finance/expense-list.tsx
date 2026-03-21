'use client';

import { useState } from 'react';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Label } from '@twicely/ui/label';
import { Badge } from '@twicely/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@twicely/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@twicely/ui/dialog';
import { formatCentsToDollars } from '@twicely/finance/format';
import { listExpensesAction, deleteExpenseAction } from '@/lib/actions/finance-center-expenses';
import { ExpenseForm } from './expense-form';
import type { ExpenseRow, ExpenseListResult } from '@/lib/queries/finance-center';

interface ExpenseListProps {
  initialData: ExpenseListResult;
  categories: readonly string[];
}

type SortBy = 'expenseDate' | 'amountCents' | 'category' | 'createdAt';
type SortOrder = 'asc' | 'desc';

function SortIndicator({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return null;
  return <span>{order === 'asc' ? ' ↑' : ' ↓'}</span>;
}

export function ExpenseList({ initialData, categories }: ExpenseListProps) {
  const [data, setData] = useState<ExpenseListResult>(initialData);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('expenseDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  async function load(nextPage: number, overrides?: { sortBy?: SortBy; sortOrder?: SortOrder }) {
    setLoading(true);
    const result = await listExpensesAction({
      page: nextPage,
      pageSize: initialData.pageSize,
      category: category || undefined,
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
    setSortBy(col); setSortOrder(newOrder);
    void load(1, { sortBy: col, sortOrder: newOrder });
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleteError(null); setDeleteLoading(true);
    const result = await deleteExpenseAction({ id: deletingId });
    setDeleteLoading(false);
    if (!result.success) { setDeleteError(result.error); return; }
    setDeletingId(null);
    void load(page);
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="filter-category">Category</Label>
          <Select value={category || '_all'} onValueChange={(v) => setCategory(v === '_all' ? '' : v)}>
            <SelectTrigger id="filter-category" className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All categories</SelectItem>
              {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-start">From</Label>
          <Input id="filter-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="filter-end">To</Label>
          <Input id="filter-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={() => void load(1)} disabled={loading}>Apply</Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium cursor-pointer hover:bg-muted" onClick={() => handleSortToggle('expenseDate')}>
                Date<SortIndicator active={sortBy === 'expenseDate'} order={sortOrder} />
              </th>
              <th className="px-4 py-2 text-left font-medium cursor-pointer hover:bg-muted" onClick={() => handleSortToggle('category')}>
                Category<SortIndicator active={sortBy === 'category'} order={sortOrder} />
              </th>
              <th className="px-4 py-2 text-left font-medium">Vendor</th>
              <th className="px-4 py-2 text-left font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium cursor-pointer hover:bg-muted" onClick={() => handleSortToggle('amountCents')}>
                Amount<SortIndicator active={sortBy === 'amountCents'} order={sortOrder} />
              </th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No expenses found.</td></tr>
            ) : data.expenses.map((exp) => (
              <tr key={exp.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(exp.expenseDate)}</td>
                <td className="px-4 py-3"><Badge variant="secondary">{exp.category}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{exp.vendor ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                  {exp.description ? (exp.description.length > 50 ? `${exp.description.slice(0, 50)}...` : exp.description) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatCentsToDollars(exp.amountCents)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingExpense(exp)}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { setDeletingId(exp.id); setDeleteError(null); }}>Delete</Button>
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
          {data.total === 0 ? 'No expenses' : `Page ${page} of ${totalPages} (${data.total} total)`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => void load(page + 1)}>Next</Button>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => { if (!open) setEditingExpense(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          {editingExpense && (
            <ExpenseForm expense={editingExpense} onSuccess={() => { setEditingExpense(null); void load(page); }} onCancel={() => setEditingExpense(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete expense</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete this expense? This cannot be undone.</p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeletingId(null)} disabled={deleteLoading}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
