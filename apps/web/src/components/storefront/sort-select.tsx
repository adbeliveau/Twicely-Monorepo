'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@twicely/ui/select';

type SortOption = 'newest' | 'price_low' | 'price_high';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  price_low: 'Price: Low to High',
  price_high: 'Price: High to Low',
};

interface SortSelectProps {
  defaultSort?: SortOption;
}

export function SortSelect({ defaultSort = 'newest' }: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = (searchParams.get('sort') as SortOption) || defaultSort;

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultSort) {
        params.delete('sort');
      } else {
        params.set('sort', value);
      }
      // Reset to page 1 when sorting changes
      params.delete('page');
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams, defaultSort]
  );

  return (
    <Select value={currentSort} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px] h-8 text-sm">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
          <SelectItem key={option} value={option}>
            {SORT_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
