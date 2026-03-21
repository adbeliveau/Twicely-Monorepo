'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
};

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  pagination?: PaginationProps;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onPageChange?: (page: number) => void;
  /** Enable row checkboxes; returns selected row indices */
  selectable?: boolean;
  onSelectionChange?: (indices: number[]) => void;
  /** Unique key extractor for each row */
  rowKey?: (row: T, index: number) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Optional action bar shown above table (e.g. filters, bulk actions) */
  toolbar?: ReactNode;
}

type SortDir = 'asc' | 'desc' | null;

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')
    return <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (dir === 'desc')
    return <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return (
    <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
  );
}

export function DataTable<T>({
  columns,
  data,
  pagination,
  searchPlaceholder = 'Search...',
  onSearch,
  onPageChange,
  selectable = false,
  onSelectionChange,
  rowKey,
  emptyMessage = 'No results found',
  toolbar,
}: DataTableProps<T>): React.ReactElement {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  function handleSearch(value: string) {
    setSearchValue(value);
    onSearch?.(value);
  }

  const toggleRow = useCallback(
    (idx: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        onSelectionChange?.(Array.from(next));
        return next;
      });
    },
    [onSelectionChange],
  );

  const toggleAll = useCallback(() => {
    if (selected.size === data.length) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(data.map((_, i) => i));
      setSelected(all);
      onSelectionChange?.(Array.from(all));
    }
  }, [data, selected.size, onSelectionChange]);

  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.pageSize)
    : 1;

  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Search + Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onSearch && (
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchValue}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-gray-600 dark:focus:ring-gray-700"
            />
          </div>
        )}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left dark:border-gray-800 dark:bg-gray-900/50">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      data.length > 0 && selected.size === data.length
                    }
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400',
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {col.header}
                      <SortIcon
                        dir={sortKey === col.key ? sortDir : null}
                      />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Inbox
                      className="h-8 w-8 text-gray-300 dark:text-gray-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {emptyMessage}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey ? rowKey(row, idx) : idx}
                  className={[
                    'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    selected.has(idx)
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : '',
                  ].join(' ')}
                >
                  {selectable && (
                    <td className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(idx)}
                        onChange={() => toggleRow(idx)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        'px-4 py-3 text-gray-700 dark:text-gray-300',
                        col.className ?? '',
                      ].join(' ')}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing{' '}
            {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(
              pagination.page * pagination.pageSize,
              pagination.total,
            )}{' '}
            of {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="px-2 tabular-nums">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              disabled={pagination.page >= totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
