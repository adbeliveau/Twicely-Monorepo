'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  addCollectionItemAction,
  removeCollectionItemAction,
  reorderCollectionItemsAction,
  searchListingsForCollectionAction,
} from '@/lib/actions/admin-curated-collections';
import type { AdminCollectionItemRow } from '@/lib/queries/admin-curated-collections';
import { CollectionDeleteButton } from './collection-delete-button';
import { formatPrice } from '@twicely/utils/format';

interface CollectionItemManagerProps {
  collectionId: string;
  items: AdminCollectionItemRow[];
}

type SearchResult = {
  id: string;
  title: string | null;
  slug: string | null;
  priceCents: number | null;
  primaryImageUrl: string | null;
};

export function CollectionItemManager({ collectionId, items: initialItems }: CollectionItemManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const currentIds = items.map((i) => i.listingId);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const result = await searchListingsForCollectionAction({
        query,
        excludeListingIds: currentIds,
      });
      setIsSearching(false);
      if ('listings' in result) setSearchResults(result.listings ?? []);
    }, 300);
    setDebounceTimer(timer);
  }, [currentIds, debounceTimer]);

  function handleAddItem(listingId: string) {
    setActionError(null);
    startTransition(async () => {
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 0;
      const result = await addCollectionItemAction({ collectionId, listingId, sortOrder: maxOrder });
      if ('error' in result) {
        setActionError(result.error ?? 'An error occurred');
      } else {
        setSearchQuery('');
        setSearchResults([]);
        router.refresh();
      }
    });
  }

  function handleRemoveItem(listingId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await removeCollectionItemAction({ collectionId, listingId });
      if ('error' in result) {
        setActionError(result.error ?? 'An error occurred');
      } else {
        setItems((prev) => prev.filter((i) => i.listingId !== listingId));
        router.refresh();
      }
    });
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const newItems = [...items];
    const tmp = newItems[index - 1]!;
    newItems[index - 1] = newItems[index]!;
    newItems[index] = tmp;
    const reordered = newItems.map((item, i) => ({ ...item, sortOrder: i }));
    setItems(reordered);
    startTransition(async () => {
      await reorderCollectionItemsAction({
        collectionId,
        items: reordered.map((item) => ({ listingId: item.listingId, sortOrder: item.sortOrder })),
      });
      router.refresh();
    });
  }

  function handleMoveDown(index: number) {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const tmp = newItems[index + 1]!;
    newItems[index + 1] = newItems[index]!;
    newItems[index] = tmp;
    const reordered = newItems.map((item, i) => ({ ...item, sortOrder: i }));
    setItems(reordered);
    startTransition(async () => {
      await reorderCollectionItemsAction({
        collectionId,
        items: reordered.map((item) => ({ listingId: item.listingId, sortOrder: item.sortOrder })),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Image</th>
              <th className="px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="px-4 py-3 font-medium text-gray-600">Price</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Order</th>
              <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item, index) => (
              <tr key={item.listingId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {item.primaryImageUrl ? (
                    <img src={item.primaryImageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-gray-100" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {item.listingTitle ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {item.listingPriceCents !== null ? formatPrice(item.listingPriceCents) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {item.listingStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{item.sortOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || isPending}
                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1 || isPending}
                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRemoveItem(item.listingId)}
                      disabled={isPending}
                      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No listings in this collection yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Add Listing</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search listings by title…"
          className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {isSearching && <p className="text-xs text-gray-500">Searching…</p>}
        {searchResults.length > 0 && (
          <ul className="max-w-md divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
            {searchResults.map((result) => (
              <li key={result.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-sm text-gray-900 truncate max-w-[240px]">
                  {result.title ?? '(no title)'}
                  {result.priceCents !== null && (
                    <span className="ml-2 text-gray-500 text-xs">{formatPrice(result.priceCents)}</span>
                  )}
                </span>
                <button
                  onClick={() => handleAddItem(result.id)}
                  disabled={isPending}
                  className="ml-4 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <CollectionDeleteButton collectionId={collectionId} redirectAfter />
      </div>
    </div>
  );
}
