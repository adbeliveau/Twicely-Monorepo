'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@twicely/ui/tabs';
import { Button } from '@twicely/ui/button';
import { Input } from '@twicely/ui/input';
import { Badge } from '@twicely/ui/badge';
import { Plus, Pause, Play, XCircle, Trash2, Search, ImageIcon } from 'lucide-react';
import type { ListingStatus, StatusCounts } from '@/lib/queries/seller-listings';

interface ListingsTableFiltersProps {
  counts: StatusCounts;
  currentStatus: ListingStatus | null;
  currentSearch: string;
  selectedCount: number;
  isProcessing: boolean;
  onBatchAction: (action: 'pause' | 'resume' | 'end' | 'delete') => Promise<void>;
  onClearSelection: () => void;
}

const STATUS_TABS: { value: ListingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'ENDED', label: 'Ended' },
];

export function ListingsTableFilters({
  counts,
  currentStatus,
  currentSearch,
  selectedCount,
  isProcessing,
  onBatchAction,
  onClearSelection,
}: ListingsTableFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Sync input with URL on mount and when URL changes
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    params.delete('page');
    router.push(`/my/selling/listings?${params.toString()}`);
  }, [router, searchParams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        const params = new URLSearchParams(searchParams.toString());
        if (searchInput.trim()) {
          params.set('search', searchInput.trim());
        } else {
          params.delete('search');
        }
        params.delete('page');
        router.push(`/my/selling/listings?${params.toString()}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, searchParams, router]);

  const getCount = (status: ListingStatus | 'ALL'): number => {
    return status === 'ALL' ? counts.all : counts[status];
  };

  return (
    <div className="space-y-4">
      {/* Search + Tabs Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={currentStatus ?? 'ALL'} onValueChange={handleTabChange}>
          <TabsList className="flex-wrap">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.label}
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">{getCount(tab.value)}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Batch Actions */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 sm:gap-4">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <Button variant="outline" size="sm" onClick={() => onBatchAction('pause')} disabled={isProcessing}>
            <Pause className="mr-2 h-4 w-4" />Pause
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBatchAction('resume')} disabled={isProcessing}>
            <Play className="mr-2 h-4 w-4" />Resume
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBatchAction('end')} disabled={isProcessing}>
            <XCircle className="mr-2 h-4 w-4" />End
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBatchAction('delete')} disabled={isProcessing}>
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>Clear</Button>
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  currentStatus: ListingStatus | null;
}

export function ListingsTableEmptyState({ currentStatus }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <ImageIcon className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">No listings</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {currentStatus ? `You don't have any ${currentStatus.toLowerCase()} listings.` : "You haven't created any listings yet."}
      </p>
      <Button asChild className="mt-4">
        <Link href="/my/selling/listings/new"><Plus className="mr-2 h-4 w-4" />Create Listing</Link>
      </Button>
    </div>
  );
}
