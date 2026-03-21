'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { HistorySortBy } from '@/lib/queries/browsing-history';

interface SortToggleProps {
  currentSort: HistorySortBy;
}

export function SortToggle({ currentSort }: SortToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSortChange = (sort: HistorySortBy) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === 'recent') {
      params.delete('sort');
    } else {
      params.set('sort', sort);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => handleSortChange('recent')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          currentSort === 'recent'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Recent
      </button>
      <button
        onClick={() => handleSortChange('most_viewed')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          currentSort === 'most_viewed'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Most Viewed
      </button>
    </div>
  );
}
