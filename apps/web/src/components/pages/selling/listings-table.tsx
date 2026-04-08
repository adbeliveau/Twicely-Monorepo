'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@twicely/ui/button';
import { Checkbox } from '@twicely/ui/checkbox';
import { Badge } from '@twicely/ui/badge';
import { ImageIcon, Heart } from 'lucide-react';
import { cn } from '@twicely/utils';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { updateListingStatus } from '@/lib/actions/listings-update-status';
import { deleteListing } from '@/lib/actions/listings-delete';
import { bulkUpdateListingStatus, bulkDeleteListings } from '@/lib/actions/seller-listings';
import type { SellerListingRow, ListingStatus, StatusCounts } from '@/lib/queries/seller-listings';
import { RowActions } from './listings-table-actions';
import { ListingsTableFilters, ListingsTableEmptyState } from './listings-table-filters';

interface ListingsTableProps {
  listings: SellerListingRow[];
  counts: StatusCounts;
  currentStatus: ListingStatus | null;
  currentSearch: string;
  page: number;
  totalPages: number;
}

const STATUS_COLORS: Record<ListingStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  SOLD: 'bg-primary/10 text-primary',
  ENDED: 'bg-red-100 text-red-800',
};

function ListingImage({ url, alt, size }: { url: string | null; alt: string; size: number }) {
  const sizeClass = size === 48 ? 'h-12 w-12' : 'h-16 w-16';
  const iconSize = size === 48 ? 'h-5 w-5' : 'h-6 w-6';
  return (
    <div className={cn('relative overflow-hidden rounded bg-muted', sizeClass)}>
      {url ? (
        <Image src={url} alt={alt} fill className="object-cover" sizes={`${size}px`} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ImageIcon className={cn('text-muted-foreground', iconSize)} />
        </div>
      )}
    </div>
  );
}

function PriceCell({ price, original }: { price: number | null; original: number | null }) {
  return (
    <div className="flex flex-col">
      <span>{price ? formatPrice(price) : '—'}</span>
      {original && original !== price && (
        <span className="text-xs text-muted-foreground line-through">{formatPrice(original)}</span>
      )}
    </div>
  );
}

export function ListingsTable({ listings, counts, currentStatus, currentSearch, page, totalPages }: ListingsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePageChange = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', newPage.toString());
    }
    router.push(`/my/selling/listings?${params.toString()}`);
  }, [router, searchParams]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(selectedIds.size === listings.length ? new Set() : new Set(listings.map((l) => l.id)));
  }, [listings, selectedIds.size]);

  const handleStatusAction = useCallback(async (listingId: string, newStatus: string) => {
    setIsProcessing(true);
    try { await updateListingStatus(listingId, newStatus); router.refresh(); }
    finally { setIsProcessing(false); }
  }, [router]);

  const handleDelete = useCallback(async (listingId: string) => {
    setIsProcessing(true);
    try { await deleteListing(listingId); router.refresh(); }
    finally { setIsProcessing(false); }
  }, [router]);

  const handleBatchAction = useCallback(async (action: 'pause' | 'resume' | 'end' | 'delete') => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      if (action === 'delete') await bulkDeleteListings(Array.from(selectedIds));
      else {
        const statusMap = { pause: 'PAUSED', resume: 'ACTIVE', end: 'ENDED' } as const;
        await bulkUpdateListingStatus(Array.from(selectedIds), statusMap[action]);
      }
      setSelectedIds(new Set());
      router.refresh();
    } finally { setIsProcessing(false); }
  }, [selectedIds, router]);

  return (
    <div className="space-y-4">
      <ListingsTableFilters counts={counts} currentStatus={currentStatus} currentSearch={currentSearch}
        selectedCount={selectedIds.size} isProcessing={isProcessing} onBatchAction={handleBatchAction}
        onClearSelection={() => setSelectedIds(new Set())} />
      {listings.length === 0 ? <ListingsTableEmptyState currentStatus={currentStatus} /> : (
        <>
          {/* Desktop Table */}
          <div className="hidden rounded-lg border md:block">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="w-12 p-3"><Checkbox checked={selectedIds.size === listings.length} onCheckedChange={toggleSelectAll} /></th>
                  <th className="w-16 p-3"></th>
                  <th className="p-3 text-left text-sm font-medium">Title</th>
                  <th className="p-3 text-left text-sm font-medium">Price</th>
                  <th className="w-20 p-3 text-left text-sm font-medium">Watchers</th>
                  <th className="p-3 text-left text-sm font-medium">Status</th>
                  <th className="p-3 text-left text-sm font-medium">Listed</th>
                  <th className="w-12 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {listings.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3"><Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></td>
                    <td className="p-3"><ListingImage url={item.primaryImageUrl} alt={item.title ?? ''} size={48} /></td>
                    <td className="p-3">
                      <Link href={`/my/selling/listings/${item.id}/edit`} className="font-medium hover:underline">{item.title || 'Untitled'}</Link>
                    </td>
                    <td className="p-3"><PriceCell price={item.priceCents} original={item.originalPriceCents} /></td>
                    <td className="p-3"><div className="flex items-center gap-1 text-sm text-muted-foreground"><Heart className="h-3 w-3" />{item.watcherCount}</div></td>
                    <td className="p-3"><Badge className={cn('font-normal', STATUS_COLORS[item.status])}>{item.status}</Badge></td>
                    <td className="p-3 text-sm text-muted-foreground">{formatDate(item.createdAt)}</td>
                    <td className="p-3"><RowActions item={item} onStatusChange={handleStatusAction} onDelete={handleDelete} disabled={isProcessing} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {listings.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex gap-3">
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                  <ListingImage url={item.primaryImageUrl} alt={item.title ?? ''} size={64} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/my/selling/listings/${item.id}/edit`} className="font-medium hover:underline">{item.title || 'Untitled'}</Link>
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      <PriceCell price={item.priceCents} original={item.originalPriceCents} />
                      <Badge className={cn('font-normal', STATUS_COLORS[item.status])}>{item.status}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {item.watcherCount}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <RowActions item={item} onStatusChange={handleStatusAction} onDelete={handleDelete} disabled={isProcessing} />
                </div>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
