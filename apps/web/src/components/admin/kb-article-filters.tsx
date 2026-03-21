'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@twicely/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@twicely/ui/select';
import { Button } from '@twicely/ui/button';

interface CategoryOption {
  id: string;
  name: string;
}

interface KbArticleFiltersProps {
  categories: CategoryOption[];
  currentStatus?: string;
  currentCategoryId?: string;
  currentAudience?: string;
  currentSearch?: string;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'All Users' },
  { value: 'BUYER', label: 'Buyers' },
  { value: 'SELLER', label: 'Sellers' },
  { value: 'AGENT_ONLY', label: 'Agents Only' },
];

export function KbArticleFilters({
  categories,
  currentStatus,
  currentCategoryId,
  currentAudience,
  currentSearch,
}: KbArticleFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function applyFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/kb?${params.toString()}`);
  }

  function clearFilters() {
    router.push('/kb');
  }

  const hasFilters = !!(currentStatus || currentCategoryId || currentAudience || currentSearch);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentStatus ?? '_all'}
        onValueChange={(v) => applyFilter('status', v === '_all' ? undefined : v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentCategoryId ?? '_all'}
        onValueChange={(v) => applyFilter('categoryId', v === '_all' ? undefined : v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentAudience ?? '_all'}
        onValueChange={(v) => applyFilter('audience', v === '_all' ? undefined : v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Audience" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All Audiences</SelectItem>
          {AUDIENCE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Search by title..."
        className="w-52"
        defaultValue={currentSearch ?? ''}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            applyFilter('search', (e.target as HTMLInputElement).value || undefined);
          }
        }}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
